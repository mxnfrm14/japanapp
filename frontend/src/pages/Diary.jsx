import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  FireIcon,
  NotebookIcon,
  PencilSimpleIcon,
  SparkleIcon,
  TrashIcon,
} from '@phosphor-icons/react'

import { requestCorrection } from '../services/diaryCorrection'
import {
  STYLE_MODE,
  calculateStreak,
  deleteEntry,
  formatDateKey,
  getStyleMode,
  listEntries,
  saveEntry,
  setStyleMode as persistStyleMode,
  shiftDateKey,
  toDateKey,
} from '../services/diaryStorage'
import {
  REGISTER,
  REGISTER_LABELS,
  charDiff,
  countDiffChanges,
  detectRegister,
} from '../utils/japaneseStyle'

const STYLE_OPTIONS = [
  { value: STYLE_MODE.AUTO, label: 'Match me', jp: '自動', hint: 'Correct within whatever register I wrote in.' },
  { value: STYLE_MODE.PLAIN, label: 'Plain', jp: 'だ体', hint: 'Keep me in casual diary form.' },
  { value: STYLE_MODE.POLITE, label: 'Polite', jp: 'です・ます', hint: 'Keep me in です・ます form.' },
]

const AUTOSAVE_DELAY_MS = 1200

export default function Diary() {
  const [dateKey, setDateKey] = useState(() => toDateKey())
  const [entries, setEntries] = useState([])
  const [text, setText] = useState('')
  const [correction, setCorrection] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved
  const [error, setError] = useState('')

  const [styleMode, setStyleMode] = useState(() => getStyleMode())

  // What was last persisted for this day, so autosave can skip no-op writes and
  // the correction can be marked stale once the text moves on.
  const persistedTextRef = useRef('')

  const refreshEntries = useCallback(async () => {
    const loaded = await listEntries()
    setEntries(loaded)
    return loaded
  }, [])

  useEffect(() => {
    let isActive = true

    const load = async () => {
      setIsLoading(true)
      setError('')

      try {
        const loaded = await refreshEntries()
        if (!isActive) return

        const entry = loaded.find((item) => item.date === dateKey)
        setText(entry?.text || '')
        setCorrection(entry?.correction || null)
        persistedTextRef.current = entry?.text || ''
        setSaveState('idle')
      } catch {
        if (isActive) setError('Could not load your diary entries.')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void load()
    return () => { isActive = false }
  }, [dateKey, refreshEntries])

  // Debounced autosave — a diary should never lose a paragraph to a stray click.
  useEffect(() => {
    if (isLoading || text === persistedTextRef.current) return undefined

    setSaveState('saving')
    const timer = setTimeout(async () => {
      try {
        await saveEntry({ date: dateKey, text, correction })
        persistedTextRef.current = text
        await refreshEntries()
        setSaveState('saved')
      } catch (saveError) {
        setError(saveError.message)
        setSaveState('idle')
      }
    }, AUTOSAVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [text, dateKey, correction, isLoading, refreshEntries])

  const handleStyleModeChange = (mode) => {
    setStyleMode(mode)
    persistStyleMode(mode)
  }

  const liveRegister = useMemo(() => detectRegister(text), [text])
  const streak = useMemo(() => calculateStreak(entries), [entries])

  // A correction describes the text it was run against; editing afterwards
  // makes it stale rather than wrong.
  const isCorrectionStale = Boolean(correction) && correction.sourceText !== text

  const handleCheck = async () => {
    if (isChecking || !text.trim()) return

    setIsChecking(true)
    setError('')

    try {
      // The server pulls this writer's recent entries itself from `entryDate`,
      // for habitual-register detection and voice context.
      const result = await requestCorrection({ text, styleMode, entryDate: dateKey })

      const stored = { ...result, sourceText: text }
      setCorrection(stored)
      await saveEntry({ date: dateKey, text, correction: stored })
      persistedTextRef.current = text
      await refreshEntries()
      setSaveState('saved')
    } catch (checkError) {
      setError(checkError.message || 'The correction failed. Try again.')
    } finally {
      setIsChecking(false)
    }
  }

  const handleAcceptCorrection = () => {
    if (!correction) return
    setText(correction.corrected)
    setCorrection({ ...correction, sourceText: correction.corrected })
  }

  const handleDelete = async () => {
    await deleteEntry(dateKey)
    setText('')
    setCorrection(null)
    persistedTextRef.current = ''
    setSaveState('idle')
    await refreshEntries()
  }

  const isToday = dateKey === toDateKey()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">
            Diary <span className="font-cjk text-2xl text-text-secondary">日記</span>
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Write a little every day. The AI corrects your Japanese without changing your voice.
          </p>
        </div>

        {streak > 0 ? (
          <div className="flex items-center gap-2 rounded-full bg-primary-subtle px-3 py-2 text-sm font-semibold text-primary">
            <FireIcon size={18} weight="fill" />
            {streak} day{streak === 1 ? '' : 's'}
          </div>
        ) : null}
      </header>

      <StyleModePicker value={styleMode} onChange={handleStyleModeChange} />

      <DateBar
        dateKey={dateKey}
        isToday={isToday}
        onChange={setDateKey}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-secondary">
          Loading your entry…
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="今日は…"
              rows={10}
              className="w-full resize-y bg-transparent font-cjk text-lg leading-8 text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>{Array.from(text).length} characters</span>
                <RegisterBadge register={liveRegister.register} />
              </div>

              <div className="flex items-center gap-2">
                <SaveIndicator state={saveState} />
                {text.trim() ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn btn-ghost btn-sm text-text-muted"
                    aria-label="Delete this entry"
                  >
                    <TrashIcon size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={!text.trim() || isChecking}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {isChecking ? (
                    <>
                      <ArrowClockwiseIcon size={16} className="animate-spin" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <SparkleIcon size={16} weight="fill" />
                      {correction ? 'Check again' : 'Check my Japanese'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-error bg-error-subtle px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : null}

          {correction ? (
            <CorrectionPanel
              correction={correction}
              isStale={isCorrectionStale}
              onAccept={handleAcceptCorrection}
            />
          ) : null}

          <EntryList entries={entries} activeDate={dateKey} onSelect={setDateKey} />
        </>
      )}
    </div>
  )
}

function StyleModePicker({ value, onChange }) {
  const active = STYLE_OPTIONS.find((option) => option.value === value)

  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Style</span>
        {STYLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              option.value === value
                ? 'border-primary bg-primary text-text-inverse'
                : 'border-border bg-surface-raised text-text-secondary hover:border-primary hover:text-primary'
            }`}
          >
            {option.label} <span className="font-cjk text-xs opacity-80">{option.jp}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted">{active?.hint}</p>
    </section>
  )
}

function DateBar({ dateKey, isToday, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftDateKey(dateKey, -1))}
        className="btn btn-ghost btn-sm"
        aria-label="Previous day"
      >
        <CaretLeftIcon size={18} weight="bold" />
      </button>

      <div className="text-center">
        <div className="font-display text-sm font-semibold text-text-primary">{formatDateKey(dateKey)}</div>
        {!isToday ? (
          <button
            type="button"
            onClick={() => onChange(toDateKey())}
            className="text-xs text-primary underline underline-offset-2"
          >
            Back to today
          </button>
        ) : (
          <div className="text-xs text-text-muted">Today</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftDateKey(dateKey, 1))}
        disabled={isToday}
        className="btn btn-ghost btn-sm disabled:opacity-30"
        aria-label="Next day"
      >
        <CaretRightIcon size={18} weight="bold" />
      </button>
    </div>
  )
}

function RegisterBadge({ register }) {
  if (register === REGISTER.UNKNOWN) return null

  const meta = REGISTER_LABELS[register]
  const tone = register === REGISTER.MIXED
    ? 'bg-warning-subtle text-warning'
    : 'bg-info-subtle text-info'

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`} title={meta.hint}>
      {meta.label} <span className="font-cjk">{meta.jp}</span>
    </span>
  )
}

function SaveIndicator({ state }) {
  if (state === 'saving') {
    return <span className="text-xs text-text-muted">Saving…</span>
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircleIcon size={14} weight="fill" />
        Saved
      </span>
    )
  }
  return null
}

/**
 * `embedded` drops the outer card chrome so the panel can sit inside an
 * accordion row without nesting one bordered box in another. `onAccept` is
 * omitted when reviewing a past day — there is nothing to apply it to.
 */
function CorrectionPanel({ correction, isStale = false, onAccept, embedded = false }) {
  const segments = useMemo(
    () => charDiff(correction.sourceText || '', correction.corrected),
    [correction.sourceText, correction.corrected],
  )
  const changeCount = countDiffChanges(segments)
  // Corrections loaded from the backend are stored jsonb and bypass the zod
  // guard that fresh results pass through, so don't assume `notes` is present.
  const notes = correction.notes ?? []
  const isClean = changeCount === 0 && notes.length === 0

  return (
    <section className={`flex flex-col gap-4 ${embedded ? '' : 'rounded-xl border border-border bg-surface p-4 shadow-sm'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`flex items-center gap-2 font-display font-semibold text-text-primary ${embedded ? 'text-sm' : 'text-lg'}`}>
          <SparkleIcon size={embedded ? 16 : 18} weight="fill" className="text-primary" />
          Correction
        </h2>
        <div className="flex items-center gap-2">
          <RegisterBadge register={correction.detected_register} />
          {!isClean && onAccept ? (
            <button type="button" onClick={onAccept} className="btn btn-sm btn-outline">
              Apply to my entry
            </button>
          ) : null}
        </div>
      </div>

      {isStale ? (
        <p className="rounded-lg bg-warning-subtle px-3 py-2 text-xs text-warning">
          You have edited the entry since this check. Run it again for up-to-date feedback.
        </p>
      ) : null}

      {correction.register_note ? (
        <p className="text-sm text-text-secondary">{correction.register_note}</p>
      ) : null}

      {isClean ? (
        <p className="rounded-lg bg-success-subtle px-3 py-3 text-sm text-success">
          No corrections — this entry reads naturally as written. 完璧！
        </p>
      ) : (
        <div className="rounded-lg bg-surface-raised p-4 font-cjk text-lg leading-9 text-text-primary">
          {segments.map((segment, index) => {
            if (segment.type === 'same') {
              return <span key={index} className="whitespace-pre-wrap">{segment.text}</span>
            }
            if (segment.type === 'del') {
              return (
                <span key={index} className="whitespace-pre-wrap rounded bg-error-subtle px-0.5 text-error line-through decoration-2">
                  {segment.text}
                </span>
              )
            }
            return (
              <span key={index} className="whitespace-pre-wrap rounded bg-success-subtle px-0.5 font-medium text-success underline decoration-2 underline-offset-4">
                {segment.text}
              </span>
            )
          })}
        </div>
      )}

      {notes.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {notes.map((note, index) => (
            <li key={index} className="flex gap-3 rounded-lg border border-border p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2 font-cjk text-base">
                  <span className="text-error line-through">{note.original}</span>
                  <span className="text-text-muted">→</span>
                  <span className="font-medium text-success">{note.corrected}</span>
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 font-ui text-[10px] uppercase tracking-wide text-text-muted">
                    {note.kind}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{note.explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {correction.encouragement ? (
        <p className="border-t border-border pt-3 text-sm italic text-text-secondary">
          {correction.encouragement}
        </p>
      ) : null}
    </section>
  )
}

function EntryList({ entries, activeDate, onSelect }) {
  // One row open at a time — the whole point is scanning back through days, and
  // a stack of expanded corrections buries the list.
  const [expandedDate, setExpandedDate] = useState(null)

  const written = entries.filter((entry) => entry.text?.trim())

  if (written.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-8 text-center">
        <NotebookIcon size={28} className="mx-auto mb-2 text-text-muted" />
        <p className="text-sm text-text-secondary">No entries yet. Two or three sentences is a good first day.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
        Past entries
      </h2>

      {written.map((entry) => {
        const isExpanded = entry.date === expandedDate
        const noteCount = entry.correction?.notes?.length || 0

        return (
          <article
            key={entry.id}
            className={`overflow-hidden rounded-lg border hover:bg-surface-raised  ${
              entry.date === activeDate ? 'border-primary bg-surface' : 'border-border bg-surface'
            }`}
            onClick={() => setExpandedDate(isExpanded ? null : entry.date)}
          >
            <h3>
              <button
                type="button"
                // onClick={() => setExpandedDate(isExpanded ? null : entry.date)}
                aria-expanded={isExpanded}
                aria-controls={`entry-panel-${entry.date}`}
                className="flex w-full items-start gap-3 p-3 text-left hover:bg-surface-raised"
              >
                <CaretDownIcon
                  size={16}
                  weight="bold"
                  className={`mt-0.5 shrink-0 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-secondary">{formatDateKey(entry.date)}</span>
                    {entry.correction ? (
                      <span className={`text-xs ${noteCount > 0 ? 'text-text-muted' : 'text-success'}`}>
                        {noteCount > 0 ? `${noteCount} note${noteCount === 1 ? '' : 's'}` : 'no corrections'}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">unchecked</span>
                    )}
                  </span>
                  <span className={`mt-1 block font-cjk text-base text-text-primary ${isExpanded ? '' : 'truncate'}`}>
                    {entry.text}
                  </span>
                </span>
              </button>
            </h3>

            {isExpanded ? (
              <div id={`entry-panel-${entry.date}`} className="flex flex-col gap-4 border-t border-border p-4">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    What you wrote
                  </div>
                  <p className="whitespace-pre-wrap font-cjk text-lg leading-8 text-text-primary">{entry.text}</p>
                </div>

                {entry.correction ? (
                  <CorrectionPanel correction={entry.correction} embedded />
                ) : (
                  <p className="rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-secondary">
                    This entry was never checked. Open it to run a correction.
                  </p>
                )}

                {entry.date !== activeDate ? (
                  <button
                    type="button"
                    onClick={() => onSelect(entry.date)}
                    className="btn btn-sm btn-outline self-start gap-2"
                  >
                    <PencilSimpleIcon size={14} />
                    Open in editor
                  </button>
                ) : (
                  <span className="self-start text-xs text-text-muted">You are editing this day above.</span>
                )}
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
