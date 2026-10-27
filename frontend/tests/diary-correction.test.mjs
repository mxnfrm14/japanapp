import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { requestCorrection } from '../src/services/diaryCorrection.js'

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } })
afterEach(() => mock.restoreAll())

test('correction sends the original writing and line breaks without a style preference', async () => {
  const text = '\n今日は図書館に行きました。\n\n楽しかったです。\n'
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { text, entry_date: '2026-10-27' })
    return new Response(JSON.stringify({ corrected: text, notes: [] }), { headers: { 'Content-Type': 'application/json' } })
  })
  const result = await requestCorrection({ text, entryDate: '2026-10-27' })
  assert.equal(result.corrected, text)
})

test('blank entries do not invoke the correction service', async () => {
  const fetch = mock.method(globalThis, 'fetch')
  await assert.rejects(requestCorrection({ text: ' \n ', entryDate: '2026-10-27' }), /Write something/)
  assert.equal(fetch.mock.callCount(), 0)
})
