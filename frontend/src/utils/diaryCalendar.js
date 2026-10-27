import { formatDateKey, shiftDateKey, toDateKey } from '../services/diaryStorage.js'

export const hasEntryContent = (entry) => Boolean(entry.title?.trim() || entry.text?.trim())

export const entryTitle = (entry) => entry.title?.trim()
  || entry.text?.split('\n').find((line) => line.trim())?.trim()
  || formatDateKey(entry.date)

export const startOfWeek = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  return shiftDateKey(dateKey, -((weekday + 6) % 7))
}

export const startOfMonth = (dateKey) => `${dateKey.slice(0, 7)}-01`

export const shiftMonth = (dateKey, count) => {
  const [year, month] = dateKey.split('-').map(Number)
  return toDateKey(new Date(year, month - 1 + count, 1))
}

export const monthLabel = (dateKey) => {
  const [year, month] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export const weekDates = (start) => Array.from({ length: 7 }, (_, index) => shiftDateKey(start, index))
export const monthDates = (month) => Array.from({ length: 42 }, (_, index) => shiftDateKey(startOfWeek(startOfMonth(month)), index))
