// Persistence for diary entries.
//
// There is no `diary` table in supabase/migrations/init_japanapp.sql and no
// /diary route on the backend yet, so entries live in localStorage for now.
// Every function here is async and returns the same shapes a REST call would,
// so swapping in `apiClient` later is a change to this file only — no page or
// component touches localStorage directly.
//
// Storage is namespaced per user id so two accounts on one browser don't read
// each other's entries.

import { useAuthStore } from '../stores/authStore'

const STORAGE_VERSION = 'v1'
const ENTRIES_KEY = 'japanapp.diary.entries'
const STYLE_MODE_KEY = 'japanapp.diary.styleMode'

export const STYLE_MODE = {
  AUTO: 'auto',
  PLAIN: 'plain',
  POLITE: 'polite',
}

const currentUserId = () => useAuthStore.getState().user?.id || 'anon'

const scopedKey = (base) => `${base}.${STORAGE_VERSION}.${currentUserId()}`

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded or storage disabled — the caller surfaces this as an error.
    return false
  }
}

/** Local calendar date as YYYY-MM-DD (never UTC — a diary day is a local day). */
export const toDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export const formatDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** All entries, newest first. */
export async function listEntries() {
  const entries = readJson(scopedKey(ENTRIES_KEY), [])
  if (!Array.isArray(entries)) return []
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))
}

export async function getEntry(dateKey) {
  const entries = await listEntries()
  return entries.find((entry) => entry.date === dateKey) || null
}

/**
 * Create or replace the entry for a given day. One entry per calendar day —
 * writing again the same day edits it rather than stacking a second record.
 */
export async function saveEntry({ date, text, correction = null }) {
  const entries = await listEntries()
  const now = new Date().toISOString()
  const existing = entries.find((entry) => entry.date === date)

  const saved = {
    id: existing?.id || `${date}-${Date.now()}`,
    date,
    text,
    correction,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  const next = [saved, ...entries.filter((entry) => entry.date !== date)]
  if (!writeJson(scopedKey(ENTRIES_KEY), next)) {
    throw new Error('Could not save the entry — browser storage is full or unavailable.')
  }

  return saved
}

export async function deleteEntry(dateKey) {
  const entries = await listEntries()
  writeJson(scopedKey(ENTRIES_KEY), entries.filter((entry) => entry.date !== dateKey))
}

export function getStyleMode() {
  const stored = localStorage.getItem(scopedKey(STYLE_MODE_KEY))
  return Object.values(STYLE_MODE).includes(stored) ? stored : STYLE_MODE.AUTO
}

export function setStyleMode(mode) {
  localStorage.setItem(scopedKey(STYLE_MODE_KEY), mode)
}

/** Consecutive days written, counting back from today (or yesterday, mid-streak). */
export function calculateStreak(entries = []) {
  const written = new Set(entries.filter((entry) => entry.text?.trim()).map((entry) => entry.date))
  if (written.size === 0) return 0

  const today = toDateKey()
  let cursor = written.has(today) ? today : shiftDateKey(today, -1)
  if (!written.has(cursor)) return 0

  let streak = 0
  while (written.has(cursor)) {
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return streak
}
