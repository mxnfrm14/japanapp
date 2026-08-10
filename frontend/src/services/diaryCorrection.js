// Turns a diary entry into a structured correction by way of POST /ai/chat.
//
// The backend exposes a generic chat endpoint (arbitrary `messages` +
// `system_prompt`), so the whole correction contract is defined here on the
// frontend: prompt in, strict JSON out, validated before it reaches the UI.

import { z } from 'zod'

import apiClient from './api'
import { STYLE_MODE } from './diaryStorage'
import { REGISTER, detectRegister } from '../utils/japaneseStyle'

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

const REGISTER_INSTRUCTIONS = {
  [STYLE_MODE.AUTO]: `
The writer has NOT chosen a target register. Detect the register they used and correct
*within* it. If they wrote plain form, the corrected text must stay plain form. If they
wrote です・ます, keep です・ます. Report a register problem ONLY when the entry is
internally inconsistent (e.g. 見た in one sentence and 見ました in the next) — and then
normalise toward whichever register dominates the entry, not toward politeness.`,

  [STYLE_MODE.PLAIN]: `
The writer has chosen plain form (だ体) as their target. Keep the corrected text in plain
form throughout. If they slipped into です・ます, convert it back to plain form and add
one note explaining the slip.`,

  [STYLE_MODE.POLITE]: `
The writer has chosen です・ます as their target. Keep the corrected text polite
throughout. If they slipped into plain form, convert it to です・ます and add one note
explaining the slip.`,
}

const buildSystemPrompt = ({ styleMode, habitualRegister }) => {
  const habitLine = habitualRegister && habitualRegister !== REGISTER.UNKNOWN
    ? `\nAcross their previous entries this writer habitually writes in ${habitualRegister} form. Treat that as their voice, not as something to fix.`
    : ''

  return `You are a Japanese writing tutor correcting a learner's diary entry (日記).

## The one rule that matters most
Register (politeness level) is the WRITER'S CHOICE, not a mistake.
Plain form (だ体 / である体) is the normal, idiomatic register for a diary. Never rewrite
plain form into です・ます. Never tell the writer they "should" use ます. Never list a
correct plain-form ending as an error.
${REGISTER_INSTRUCTIONS[styleMode] || REGISTER_INSTRUCTIONS[STYLE_MODE.AUTO]}${habitLine}

## What to correct
Correct only genuine errors: wrong particles, wrong conjugation or tense, wrong word
choice, unnatural phrasing a native speaker would not write, and kana/kanji mistakes.

## What to leave alone
- Their voice, sentence rhythm, and vocabulary level. Do not "improve" correct Japanese.
- Simple sentences. A beginner writing simply is not making a mistake.
- Personal names, place names, and invented words.
- Anything you are unsure about — say nothing rather than guessing.
If the entry is already correct, return it unchanged with an empty notes array.

## Output
Reply with a single JSON object and nothing else — no prose, no markdown fences.

{
  "detected_register": "plain" | "polite" | "mixed" | "unknown",
  "register_note": "One short sentence naming the register they used. Neutral, never corrective, unless the entry mixes registers.",
  "corrected": "The full corrected entry. Preserve their line breaks. If nothing is wrong, repeat the entry verbatim.",
  "notes": [
    {
      "original": "the exact substring from their entry",
      "corrected": "what it should be",
      "kind": "particle" | "conjugation" | "word choice" | "naturalness" | "orthography",
      "explanation": "One or two sentences in English explaining WHY. Name the rule so it transfers to the next entry."
    }
  ],
  "encouragement": "One specific sentence in English about something they did well. Reference actual content from the entry, not generic praise."
}

Explanations and encouragement are in English. The corrected text and the note
original/corrected fields stay in Japanese.`
}

const buildUserPrompt = ({ text, recentEntries }) => {
  const context = recentEntries.length > 0
    ? `Previous entries by the same writer, for voice and level reference only — do not correct these:\n${
      recentEntries.map((entry) => `[${entry.date}] ${entry.text.slice(0, 200)}`).join('\n')
    }\n\n`
    : ''

  return `${context}Today's entry to correct:\n"""\n${text}\n"""`
}

/**
 * Models sometimes wrap JSON in prose or fences despite instructions. Pull out
 * the outermost object before parsing.
 */
const extractJson = (reply) => {
  const text = typeof reply === 'string' ? reply : reply?.reply || ''
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The AI reply did not contain a correction.')
  }

  return JSON.parse(candidate.slice(start, end + 1))
}

/**
 * @param {object} options
 * @param {string} options.text          the entry to correct
 * @param {string} options.styleMode     STYLE_MODE value — the writer's target register
 * @param {string} options.habitualRegister  dominant register of past entries
 * @param {Array}  options.recentEntries up to a few past entries, for voice reference
 * @param {AbortSignal} [options.signal]
 */
export async function requestCorrection({
  text,
  styleMode = STYLE_MODE.AUTO,
  habitualRegister = REGISTER.UNKNOWN,
  recentEntries = [],
  signal,
}) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Write something before asking for a correction.')
  }

  const response = await apiClient.post('/ai/chat', {
    messages: [{ role: 'user', content: buildUserPrompt({ text: trimmed, recentEntries }) }],
    system_prompt: buildSystemPrompt({ styleMode, habitualRegister }),
    // Low temperature: corrections should be reproducible, not creative.
    temperature: 0.2,
    max_tokens: 2000,
  }, { signal })

  let parsed
  try {
    parsed = correctionSchema.parse(extractJson(response.data))
  } catch {
    throw new Error('The AI returned a correction in an unexpected format. Try again.')
  }

  // The local heuristic is the tiebreaker when the model reports "unknown" —
  // it is deterministic and cheap, and register is the thing we care most about.
  const local = detectRegister(trimmed)
  const detectedRegister = parsed.detected_register === 'unknown' ? local.register : parsed.detected_register

  return {
    ...parsed,
    detected_register: detectedRegister,
    localRegister: local.register,
    checkedAt: new Date().toISOString(),
  }
}
