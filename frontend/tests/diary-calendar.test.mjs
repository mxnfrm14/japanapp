import assert from 'node:assert/strict'
import { test } from 'node:test'
import { entryTitle, hasEntryContent, monthDates, shiftMonth, startOfWeek, weekDates } from '../src/utils/diaryCalendar.js'

test('weeks start on Monday, including Sundays and year boundaries', () => {
  assert.equal(startOfWeek('2026-10-27'), '2026-10-26')
  assert.equal(startOfWeek('2026-11-01'), '2026-10-26')
  assert.equal(startOfWeek('2026-01-01'), '2025-12-29')
  assert.deepEqual(weekDates('2025-12-29'), ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
})

test('calendar includes leap day and neighboring months without duplicate days', () => {
  const dates = monthDates('2024-02-01')
  assert.equal(dates.length, 42)
  assert.equal(new Set(dates).size, 42)
  assert.equal(dates[0], '2024-01-29')
  assert.equal(dates.at(-1), '2024-03-10')
  assert.equal(dates.includes('2024-02-29'), true)
})

test('month navigation does not overflow long months into another month', () => {
  assert.equal(shiftMonth('2024-01-31', 1), '2024-02-01')
  assert.equal(shiftMonth('2026-12-01', 1), '2027-01-01')
  assert.equal(shiftMonth('2026-01-01', -1), '2025-12-01')
})

test('title-only entries get a calendar dot, empty rows do not', () => {
  assert.equal(hasEntryContent({ title: 'A day to remember', text: '' }), true)
  assert.equal(hasEntryContent({ text: '今日は楽しかった。' }), true)
  assert.equal(hasEntryContent({ title: '  ', text: '\n ' }), false)
})

test('legacy entry titles fall back to the first nonempty line', () => {
  assert.equal(entryTitle({ title: ' My title ', text: 'Body' }), 'My title')
  assert.equal(entryTitle({ text: '\n  First line  \nSecond line' }), 'First line')
})
