// Helpers for reasoning about the *register* (politeness level) of Japanese
// prose, and for diffing an entry against its corrected version.
//
// The diary deliberately treats register as the writer's choice rather than a
// mistake: a 日記 written in plain form (だ体) is idiomatic, and the corrector
// must never "upgrade" it to です・ます. These helpers let the UI show the
// writer which register it detected without acting on it.

const SENTENCE_SPLIT = /[。．！？!?\n]+/
const TRAILING_PARTICLES = /[ねよかなわぞぜさっ、,\s]+$/u

const POLITE_TAIL = /(です|でした|でしょう|ます|ました|ません|ませんでした|ましょう|ください|でございます)$/
const PLAIN_TAIL = /(だ|だった|である|であった|た|る|う|い|ない|なかった|くない|よう|ろ)$/

export const REGISTER = {
  PLAIN: 'plain',
  POLITE: 'polite',
  MIXED: 'mixed',
  UNKNOWN: 'unknown',
}

export const REGISTER_LABELS = {
  [REGISTER.PLAIN]: { label: 'Plain', jp: 'だ体', hint: 'Casual diary form — the natural default for 日記.' },
  [REGISTER.POLITE]: { label: 'Polite', jp: 'です・ます', hint: 'Polite form — fine for a diary, just keep it consistent.' },
  [REGISTER.MIXED]: { label: 'Mixed', jp: '混在', hint: 'You switched between plain and polite mid-entry.' },
  [REGISTER.UNKNOWN]: { label: 'Not detected', jp: '—', hint: 'Not enough full sentences to tell yet.' },
}

/**
 * Classify the politeness register of an entry by looking at how each sentence
 * ends. Returns counts alongside the verdict so the UI can explain itself.
 */
export function detectRegister(text) {
  const sentences = String(text || '')
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  let polite = 0
  let plain = 0

  sentences.forEach((sentence) => {
    const tail = sentence.replace(TRAILING_PARTICLES, '')
    if (!tail) return

    // Polite is tested first: ました also ends in た.
    if (POLITE_TAIL.test(tail)) {
      polite += 1
    } else if (PLAIN_TAIL.test(tail)) {
      plain += 1
    }
    // Sentences ending in a bare noun (体言止め) are register-neutral: skipped.
  })

  const total = polite + plain
  if (total === 0) {
    return { register: REGISTER.UNKNOWN, polite, plain, politeRatio: 0 }
  }

  const politeRatio = polite / total
  let register = REGISTER.MIXED
  if (politeRatio >= 0.8) register = REGISTER.POLITE
  else if (politeRatio <= 0.2) register = REGISTER.PLAIN

  return { register, polite, plain, politeRatio }
}

/**
 * Dominant register across a set of past entries — the writer's habitual voice,
 * fed to the corrector so it matches what they already do.
 */
export function summariseStyle(entries = []) {
  const tally = { [REGISTER.PLAIN]: 0, [REGISTER.POLITE]: 0, [REGISTER.MIXED]: 0 }

  entries.forEach((entry) => {
    const { register } = detectRegister(entry.text)
    if (register in tally) tally[register] += 1
  })

  const sampled = tally[REGISTER.PLAIN] + tally[REGISTER.POLITE] + tally[REGISTER.MIXED]
  if (sampled === 0) {
    return { register: REGISTER.UNKNOWN, sampled }
  }

  const register = Object.keys(tally).reduce((best, key) => (tally[key] > tally[best] ? key : best), REGISTER.PLAIN)
  return { register, sampled }
}

// Beyond this many differing characters the quadratic LCS table is not worth
// building; the panel falls back to showing the two versions whole.
const MAX_DIFF_CHARS = 1200

/**
 * Character-level diff. Japanese has no spaces, so word-level diffing is not an
 * option — but corrections are usually a few characters, and trimming the
 * shared prefix/suffix keeps the LCS table tiny in practice.
 *
 * @returns {{type: 'same'|'del'|'ins', text: string}[]}
 */
export function charDiff(before, after) {
  const a = Array.from(String(before || ''))
  const b = Array.from(String(after || ''))

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1

  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }

  const segments = []
  const push = (type, text) => {
    if (!text) return
    const last = segments[segments.length - 1]
    if (last && last.type === type) last.text += text
    else segments.push({ type, text })
  }

  push('same', a.slice(0, start).join(''))

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length > MAX_DIFF_CHARS || midB.length > MAX_DIFF_CHARS) {
    push('del', midA.join(''))
    push('ins', midB.join(''))
  } else {
    lcsDiff(midA, midB).forEach((segment) => push(segment.type, segment.text))
  }

  push('same', a.slice(endA).join(''))
  return segments
}

function lcsDiff(a, b) {
  const n = a.length
  const m = b.length
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] = a[i] === b[j]
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  const out = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i += 1
    } else {
      out.push({ type: 'ins', text: b[j] })
      j += 1
    }
  }

  while (i < n) {
    out.push({ type: 'del', text: a[i] })
    i += 1
  }
  while (j < m) {
    out.push({ type: 'ins', text: b[j] })
    j += 1
  }

  return out
}

export function countDiffChanges(segments = []) {
  return segments.filter((segment) => segment.type !== 'same').length
}
