import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpenIcon,
  BookmarkSimpleIcon,
  ArrowsClockwiseIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react'
import { useDailyWord } from '../hooks/useApi'
import {
  bumpNonce,
  getDayNumber,
  getNonce,
  listBookmarks,
  toDateKey,
  toggleBookmark,
} from '../services/dailyWord'
import { toRomaji } from '../utils/romaji'

const KANJI_RANGE = /[一-龯]/

/** Split a sentence so the day's word can be tinted inside it. */
function highlightWord(sentence, word, reading) {
  const text = String(sentence || '')
  const needle = [word, reading].find((candidate) => candidate && text.includes(candidate))
  if (!needle) return [{ text, match: false }]

  const parts = []
  let cursor = 0

  for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, cursor)) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false })
    parts.push({ text: needle, match: true })
    cursor = index + needle.length
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}

function IconButton({ label, onClick, active = false, disabled = false, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-surface p-3 shadow-sm transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'text-primary' : 'text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

export default function DailyWordCard() {
  const navigate = useNavigate()
  const dateKey = useMemo(() => toDateKey(), [])
  const [nonce, setNonce] = useState(() => getNonce(dateKey))
  const { data: word, isLoading, isFetching, error } = useDailyWord({ dateKey, nonce })
  // Saved ids are mirrored in state so the bookmark toggle re-renders; localStorage
  // stays the source of truth.
  const [savedIds, setSavedIds] = useState(() => new Set(listBookmarks().map((b) => b.id)))

  const dayNumber = useMemo(() => getDayNumber(dateKey), [dateKey])
  const saved = word?.id ? savedIds.has(word.id) : false

  const speak = () => {
    if (!word || typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(word.japanese)
    utterance.lang = 'ja-JP'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-gray-200 bg-bg-card p-6 text-text-secondary shadow-sm dark:border-gray-700 md:p-8">
        Loading today&apos;s word...
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
        Could not load the word of the day.
      </section>
    )
  }

  if (!word) {
    return (
      <section className="rounded-3xl border border-gray-200 bg-bg-card p-6 text-text-secondary shadow-sm dark:border-gray-700 md:p-8">
        No vocabulary available yet.
      </section>
    )
  }

  const romaji = toRomaji(word.reading)
  const watermark = Array.from(word.japanese || '').find((char) => KANJI_RANGE.test(char))
  const linkedKanji = word.linked_kanjis?.[0]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-bg-card p-6 shadow-sm dark:border-gray-700 md:p-8">
      {watermark && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 right-4 select-none font-display text-[12rem] leading-none text-gray-100 dark:text-gray-800 md:text-[16rem]"
        >
          {watermark}
        </span>
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div className="border-l-4 border-primary pl-4">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Word of the day
          </div>
          <div className="mt-1 text-sm text-text-muted">
            Day {dayNumber}
            {word.difficulty_level ? ` • N${word.difficulty_level}` : ''}
          </div>
        </div>

        <div className="flex gap-2">
          <IconButton
            label={saved ? 'Remove from saved words' : 'Save this word'}
            active={saved}
            onClick={() => {
              toggleBookmark(word)
              setSavedIds(new Set(listBookmarks().map((b) => b.id)))
            }}
          >
            <BookmarkSimpleIcon size={20} weight={saved ? 'fill' : 'regular'} />
          </IconButton>
          <IconButton label="Pronounce" onClick={speak} disabled={!canSpeak}>
            <SpeakerHighIcon size={20} />
          </IconButton>
          <IconButton
            label="Show another word"
            disabled={isFetching}
            onClick={() => setNonce(bumpNonce(dateKey))}
          >
            <ArrowsClockwiseIcon size={20} className={isFetching ? 'animate-spin' : ''} />
          </IconButton>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-display text-5xl font-bold text-text-primary md:text-6xl">
          {word.japanese}
        </h2>
        {word.reading && (
          <span className="font-cjk text-2xl text-primary md:text-3xl">{word.reading}</span>
        )}
      </div>

      {romaji && <div className="relative mt-2 text-sm text-text-muted">{romaji}</div>}

      <p className="relative mt-3 text-xl text-text-secondary md:text-2xl">
        {word.meaning || 'No meaning provided.'}
      </p>

      {word.example_sentence && (
        <div className="relative mt-8">
          <p className="font-display text-xl text-text-primary md:text-2xl">
            {highlightWord(word.example_sentence, word.japanese, word.reading).map((part, index) => (
              <span key={index} className={part.match ? 'text-primary' : undefined}>
                {part.text}
              </span>
            ))}
          </p>
          {word.example_translation && (
            <p className="mt-2 text-sm text-text-muted">{word.example_translation}</p>
          )}
        </div>
      )}

      <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate(`/vocabulary/${word.id}`, { state: { item: word } })}
          className="flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:text-primary"
        >
          <BookOpenIcon size={20} />
          View full details
        </button>

        {linkedKanji && (
          <button
            type="button"
            onClick={() => navigate(`/kanji/${linkedKanji.kanji_id}`)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:text-primary"
          >
            <span className="font-cjk text-lg">{linkedKanji.kanji || '字'}</span>
            Learn kanji
          </button>
        )}
      </div>
    </section>
  )
}
