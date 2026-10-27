// Diary correction, via POST /diary/correct.
//
// The prompt, the model call, and the JSON validation all live on the backend
// now. The server also picks up the writer's recent entries itself (from
// `entry_date`) for vocabulary and voice context, so
// nothing about the correction contract is decided here any more.
//
// The zod schema below is a boundary guard, not the primary validation — the
// server validates too. It exists so a contract drift surfaces as a clear error
// instead of an undefined field rendering blank in the correction panel.

import { z } from 'zod'

import apiClient from './api.js'

const noteSchema = z.object({
  original: z.string().default(''),
  corrected: z.string().default(''),
  kind: z.string().default('grammar'),
  explanation: z.string().default(''),
})

const correctionSchema = z.object({
  detected_register: z.enum(['plain', 'polite', 'mixed', 'unknown']).catch('unknown'),
  register_note: z.string().default(''),
  corrected: z.string().min(1),
  notes: z.array(noteSchema).default([]),
  encouragement: z.string().default(''),
})

export const NOTE_KINDS = ['particle', 'conjugation', 'word choice', 'naturalness', 'orthography', 'grammar']

/**
 * @param {object} options
 * @param {string} options.text        the entry to correct
 * @param {string} options.entryDate   the entry's date key (YYYY-MM-DD) — lets the
 *                                     server pull the writer's own recent entries for context
 * @param {AbortSignal} [options.signal]
 */
export async function requestCorrection({ text, entryDate, signal }) {
  if (!text.trim()) {
    throw new Error('Write something before asking for a correction.')
  }

  const response = await apiClient.post(
    '/diary/correct',
    { text, entry_date: entryDate },
    { signal },
  )

  const result = correctionSchema.safeParse(response.data)
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ')
    console.error('[diary] correction response failed validation', {
      fields,
      body: response.data,
      issues: result.error.issues,
    })
    throw new Error(`The correction was missing something the app needs (${fields}). Try again.`)
  }

  return { ...result.data, checkedAt: new Date().toISOString() }
}
