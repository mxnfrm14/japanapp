import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpenIcon,
  ArrowsClockwiseIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react'
import { useDailyWord } from '../hooks/useApi'
import {
  bumpNonce,
  getDayNumber,
  getNonce,
  toDateKey,
} from '../services/dailyWord'
import { useFavoriteItems } from '../hooks/useFavorites'
import FavoriteButton from './FavoriteButton'
import FavoritesNotice from './FavoritesNotice'

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

function IconButton({ label, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="daily-word-icon"
    >
      {children}
    </button>
  )
}

export default function DailyWordCard() {
  const navigate = useNavigate()
  const dateKey = useMemo(() => toDateKey(), [])
  const [nonce, setNonce] = useState(() => getNonce(dateKey))
  const { data: word, isLoading, isFetching, error, refetch } = useDailyWord({ dateKey, nonce })
  const favorites = useFavoriteItems('vocabulary', [word?.id])

  const dayNumber = useMemo(() => getDayNumber(dateKey), [dateKey])

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
      <section className="home-panel daily-word-card daily-word-placeholder" aria-label="Word of the day" aria-busy="true">
        <p className="daily-word-eyebrow">WORD OF THE DAY</p>
        <div className="daily-word-skeleton" aria-hidden="true" />
        <p role="status">Loading today&apos;s word…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="home-panel daily-word-card daily-word-placeholder" aria-label="Word of the day">
        <p className="daily-word-eyebrow">WORD OF THE DAY</p>
        <h2>A little pause.</h2>
        <p role="alert">Could not load the word of the day.</p>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="daily-word-primary">{isFetching ? 'Trying again…' : 'Try again'}</button>
      </section>
    )
  }

  if (!word) {
    return (
      <section className="home-panel daily-word-card daily-word-placeholder" aria-label="Word of the day">
        <p className="daily-word-eyebrow">WORD OF THE DAY</p>
        <h2>Your next discovery is on its way.</h2>
        <p role="status">No vocabulary available yet. You can explore the kana in the meantime.</p>
        <button type="button" onClick={() => navigate('/kana')} className="daily-word-primary">Explore kana</button>
      </section>
    )
  }

  const watermark = Array.from(word.japanese || '').find((char) => KANJI_RANGE.test(char))
  const linkedKanjis = word.linked_kanjis || []

  return (
    <section className="home-panel daily-word-card" aria-labelledby="daily-word-heading">
      {watermark && (
        <span
          aria-hidden="true"
          className="daily-word-watermark font-cjk"
        >
          {watermark}
        </span>
      )}

      <div className="daily-word-header">
        <div>
          <div className="daily-word-eyebrow">
            Word of the day
          </div>
          <div className="daily-word-meta">
            Discovery day {dayNumber}
            {word.difficulty_level ? ` • N${word.difficulty_level}` : ''}
          </div>
        </div>

        <div className="daily-word-tools">
          <FavoriteButton {...favorites.forItem(word.id)} />
          <IconButton label="Pronounce" onClick={speak} disabled={!canSpeak}>
            <SpeakerHighIcon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Show another word"
            disabled={isFetching}
            onClick={() => setNonce(bumpNonce(dateKey))}
          >
            <ArrowsClockwiseIcon size={20} aria-hidden="true" className={isFetching ? 'animate-spin' : ''} />
          </IconButton>
        </div>
      </div>

      <div className="relative">
        <FavoritesNotice favorites={favorites} />
      </div>

      <div className="daily-word-content">
        <p lang="ja" className="daily-word-kicker font-cjk">今日の単語</p>
        <h2 id="daily-word-heading" lang="ja" className="daily-word-japanese font-cjk">
          {word.japanese}
        </h2>
        {word.reading && (
          <p lang="ja" className="daily-word-reading font-cjk">{word.reading}</p>
        )}
        <p className="daily-word-meaning">{word.meaning || 'No meaning provided.'}</p>
      </div>

      {word.example_sentence && (
        <div className="daily-word-example">
          <p lang="ja" className="font-cjk">
            {highlightWord(word.example_sentence, word.japanese, word.reading).map((part, index) => (
              <span key={index} className={part.match ? 'daily-word-highlight' : undefined}>
                {part.text}
              </span>
            ))}
          </p>
          {word.example_translation && (
            <p className="daily-word-translation">{word.example_translation}</p>
          )}
        </div>
      )}

      <div className="daily-word-actions">
        <button
          type="button"
          onClick={() => navigate(`/vocabulary/${word.id}`, { state: { item: word } })}
          className="daily-word-primary"
        >
          <BookOpenIcon size={20} aria-hidden="true" />
          View full details
        </button>

        {linkedKanjis.length > 0 && (
          <div className="daily-word-kanjis" role="group" aria-labelledby="daily-word-kanjis-label">
            <span id="daily-word-kanjis-label" className="daily-word-kanjis-label">
              {linkedKanjis.length > 1 ? 'Choose a kanji' : 'Learn kanji'}
            </span>
            {linkedKanjis.map((kanji) => (
              <Link
                key={kanji.kanji_id}
                to={`/kanji/${kanji.kanji_id}`}
                aria-label={`Learn kanji ${kanji.kanji || '字'}`}
                className="daily-word-secondary daily-word-kanji font-cjk"
                lang="ja"
              >
                {kanji.kanji || '字'}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
