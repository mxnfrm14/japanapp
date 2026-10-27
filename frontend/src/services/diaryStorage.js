// Persistence for diary entries.
//
// Entries live on the backend (`/diary/*`, one row per user per calendar day).
// This module is the only place that talks to those routes — no page or
// component calls the API for diary data directly.

import apiClient from './api.js'

/** Backend rows are snake_case; the rest of the frontend is camelCase. */
const mapEntry = (entry) => ({
  id: entry.id,
  date: entry.date,
  title: entry.title || '',
  text: entry.text,
  correction: entry.correction,
  createdAt: entry.created_at,
  updatedAt: entry.updated_at,
})

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

const PAGE_LIMIT = 100 // the backend's `Query(le=100)` ceiling
const MAX_PAGES = 50 // ~13 years of daily writing; a stop against a runaway has_more

/**
 * All entries, newest first.
 *
 * Deliberately pages through the whole history rather than returning one page:
 * the streak count, calendar markers, and journal history need the full set,
 * not just the currently visible month.
 */
export async function listEntries() {
  const items = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await apiClient.get('/diary/list', { params: { page, limit: PAGE_LIMIT } })
    items.push(...(data.items || []))
    if (!data.has_more) break
  }

  // Sorted here rather than trusted from the wire — callers treat "newest
  // first" as this function's contract for journal history.
  return items.map(mapEntry).sort((a, b) => b.date.localeCompare(a.date))
}

export async function getEntry(dateKey) {
  try {
    const { data } = await apiClient.get(`/diary/${dateKey}`)
    return mapEntry(data)
  } catch (error) {
    // A day that was never written is a normal state, not a failure.
    if (error.response?.status === 404) return null
    throw error
  }
}

/**
 * Create or replace the entry for a given day. PUT upserts on
 * (user_id, entry_date), so the editor's autosave can fire repeatedly without
 * stacking duplicate rows.
 */
export async function saveEntry({ date, title = '', text, correction = null }) {
  const { data } = await apiClient.put(`/diary/${date}`, { title, text, correction })
  return mapEntry(data)
}

export async function deleteEntry(dateKey) {
  await apiClient.delete(`/diary/${dateKey}`)
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
