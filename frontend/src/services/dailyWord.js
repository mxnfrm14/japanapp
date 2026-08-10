// Word of the day: pick one vocabulary item per calendar day.
//
// There is no `/vocabulary/daily` (or `/vocabulary/random`, or a total count) on
// the backend — only the paginated `/vocabulary/list`. So the pick is made
// client-side and made *deterministic* instead of random: a hash of the local
// date seeds both the page and the row inside it, which means the same day
// always yields the same word (across reloads and across tabs) while every new
// day yields a different one.
//
// Because the list endpoint reports neither a total nor a page count, this module
// learns the size of the corpus as it goes: each request narrows a persisted
// [highest page with rows, lowest empty page] bracket, so probing costs a couple
// of extra requests on the very first day and none afterwards.
//
// If the backend later exposes a real daily/random endpoint, only
// `resolveDailyWord` needs to change.

import apiClient from './api'
import { useAuthStore } from '../stores/authStore'
import { toDateKey } from './diaryStorage'

const STORAGE_VERSION = 'v1'
const SELECTION_KEY = 'japanapp.dailyWord.selection'
const BOOKMARKS_KEY = 'japanapp.dailyWord.bookmarks'
const START_DATE_KEY = 'japanapp.dailyWord.startDate'
const BOUNDS_KEY = `japanapp.dailyWord.bounds.${STORAGE_VERSION}`

const PAGE_SIZE = 100
// Upper bound used before anything is known about the corpus: 40 * 100 words.
const INITIAL_PAGE_CEILING = 40
const MAX_PROBES = 8

const currentUserId = () => useAuthStore.getState().user?.id || 'anon'

const scopedKey = (base) => `${base}.${STORAGE_VERSION}.${currentUserId()}`

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or disabled — the daily word still works, it just re-probes.
  }
}

/** FNV-1a: small, stable across browsers, good enough to spread dates apart. */
const hash = (input) => {
  let value = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

export { toDateKey }

/**
 * "Day N" badge — days elapsed since the first time the card was rendered.
 * Stored on first read so a returning user keeps counting from their real start.
 */
export function getDayNumber(dateKey = toDateKey()) {
  const key = scopedKey(START_DATE_KEY)
  let start = localStorage.getItem(key)

  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    start = dateKey
    try {
      localStorage.setItem(key, start)
    } catch {
      // Not persisted: the badge just restarts at Day 1 next visit.
    }
  }

  const [sy, sm, sd] = start.split('-').map(Number)
  const [cy, cm, cd] = dateKey.split('-').map(Number)
  const elapsed = Date.UTC(cy, cm - 1, cd) - Date.UTC(sy, sm - 1, sd)
  return Math.max(1, Math.floor(elapsed / 86400000) + 1)
}

const readBounds = () => {
  const bounds = readJson(BOUNDS_KEY, {})
  return {
    maxKnownPage: Number(bounds.maxKnownPage) || 1,
    firstEmptyPage: Number(bounds.firstEmptyPage) || null,
  }
}

const writeBounds = (bounds) => writeJson(BOUNDS_KEY, bounds)

/**
 * Fetch one page and fold what it reveals back into the persisted bracket.
 * Returns the page's items.
 */
const fetchPage = async (page, bounds) => {
  const response = await apiClient.get('/vocabulary/list', {
    params: { page, limit: PAGE_SIZE },
  })
  const items = response.data?.items || []

  if (items.length > 0) {
    bounds.maxKnownPage = Math.max(bounds.maxKnownPage, page)
    // No further pages: everything above this one is empty.
    if (!response.data?.has_more) {
      bounds.firstEmptyPage = page + 1
    }
  } else {
    bounds.firstEmptyPage = Math.min(bounds.firstEmptyPage ?? Number.MAX_SAFE_INTEGER, page)
  }

  writeBounds(bounds)
  return items
}

/** Pick a vocabulary item deterministically from `seed`, probing for the corpus size. */
const pickItem = async (seed) => {
  const bounds = readBounds()
  const ceiling = Math.max(
    bounds.maxKnownPage,
    bounds.firstEmptyPage ? bounds.firstEmptyPage - 1 : INITIAL_PAGE_CEILING,
  )

  let page = (seed % Math.max(1, ceiling)) + 1
  const tried = new Set()

  for (let probe = 0; probe < MAX_PROBES; probe += 1) {
    if (tried.has(page)) break
    tried.add(page)

    const items = await fetchPage(page, bounds)
    if (items.length > 0) {
      // A second, independent slice of the seed picks the row.
      return items[(seed >>> 8) % items.length]
    }

    if (page === 1) return null
    // Empty page: the corpus is smaller than assumed — halve and retry.
    page = Math.max(1, Math.floor(page / 2))
  }

  return null
}

const readSelection = () => readJson(scopedKey(SELECTION_KEY), null)

const writeSelection = (selection) => writeJson(scopedKey(SELECTION_KEY), selection)

/** Reroll counter for the current day — `0` unless the user pressed refresh. */
export function getNonce(dateKey = toDateKey()) {
  const selection = readSelection()
  return selection?.date === dateKey ? Number(selection.nonce) || 0 : 0
}

export function bumpNonce(dateKey = toDateKey()) {
  const next = getNonce(dateKey) + 1
  writeSelection({ date: dateKey, nonce: next, id: null })
  return next
}

/**
 * The vocabulary detail for `dateKey`/`nonce`.
 *
 * The chosen id is cached per day so the word cannot drift mid-day as the page
 * bracket sharpens; on later loads it is a single detail request.
 */
export async function resolveDailyWord({ dateKey = toDateKey(), nonce = 0 } = {}) {
  const cached = readSelection()

  if (cached?.date === dateKey && (Number(cached.nonce) || 0) === nonce && cached.id) {
    try {
      const response = await apiClient.get(`/vocabulary/${cached.id}`)
      return response.data
    } catch {
      // Item deleted or unreachable — fall through and pick again.
    }
  }

  const seed = hash(`${currentUserId()}#${dateKey}#${nonce}`)
  const item = await pickItem(seed)
  if (!item) return null

  writeSelection({ date: dateKey, nonce, id: item.id })

  try {
    const response = await apiClient.get(`/vocabulary/${item.id}`)
    return response.data
  } catch {
    // Detail failed: the list row still carries japanese/reading/meaning/level.
    return item
  }
}

export function listBookmarks() {
  const bookmarks = readJson(scopedKey(BOOKMARKS_KEY), [])
  return Array.isArray(bookmarks) ? bookmarks : []
}

export function isBookmarked(id) {
  return listBookmarks().some((bookmark) => bookmark.id === id)
}

/**
 * Save/unsave the word. There is no flashcard or deck endpoint on the backend
 * yet, so saved words live in localStorage — same interim approach as the diary.
 */
export function toggleBookmark(item) {
  if (!item?.id) return false

  const bookmarks = listBookmarks()
  const existing = bookmarks.some((bookmark) => bookmark.id === item.id)

  const next = existing
    ? bookmarks.filter((bookmark) => bookmark.id !== item.id)
    : [
        {
          id: item.id,
          japanese: item.japanese,
          reading: item.reading || null,
          meaning: item.meaning || null,
          savedAt: new Date().toISOString(),
        },
        ...bookmarks,
      ]

  writeJson(scopedKey(BOOKMARKS_KEY), next)
  return !existing
}
