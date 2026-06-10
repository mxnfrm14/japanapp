import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../services/api'

const VIEW_MODES = [
  { key: 'cards', label: 'Card view' },
  { key: 'list', label: 'List view' },
]

const JLPT_LEVELS = [
  { key: 'all', label: 'All levels' },
  { key: '5', label: 'N5' },
  { key: '4', label: 'N4' },
  { key: '3', label: 'N3' },
  { key: '2', label: 'N2' },
  { key: '1', label: 'N1' },
]

const JLPT_ORDER = ['5', '4', '3', '2', '1']

const formatReadings = (readings = []) => {
  if (!Array.isArray(readings) || readings.length === 0) {
    return '—'
  }

  return readings.join(' · ')
}

function KanjiCard({ item }) {
  const navigate = useNavigate()

  return (
    <article className="flex h-full flex-col rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-cjk text-5xl leading-none text-text-primary md:text-6xl">{item.kanji}</div>
        </div>

        <div className="badge badge-lg badge-primary">N{item.jlpt_level ?? '—'}</div>
      </div>

      <div className="mt-4 space-y-3 text-sm text-text-secondary">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Onyomi</div>
          <p className="mt-1 text-text-primary">{formatReadings(item.onyomi)}</p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Kunyomi</div>
          <p className="mt-1 text-text-primary">{formatReadings(item.kunyomi)}</p>
        </div>
      </div>

      <h4 className="mt-4 flex-1 text-sm leading-6 text-text-primary">{item.meaning || 'No meaning provided.'}</h4>

      <button
        type="button"
        onClick={() => navigate(`/kanji/${item.id}`, { state: { item } })}
        className="mt-5 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary dark:border-gray-700"
      >
        See more
      </button>
    </article>
  )
}

function KanjiRow({ item }) {
  const navigate = useNavigate()

  return (
    <tr className="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
      <td className="py-4 pr-4 align-top">
        <div className="font-cjk text-3xl text-text-primary">{item.kanji}</div>
      </td>
      <td className="py-4 pr-4 align-top">
        <div className="text-sm font-medium text-text-primary">N{item.jlpt_level ?? '—'}</div>
      </td>
      <td className="py-4 pr-4 align-top text-sm text-text-secondary">
        <div className="font-semibold text-text-primary">Onyomi</div>
        <div className="mt-1">{formatReadings(item.onyomi)}</div>
        <div className="mt-3 font-semibold text-text-primary">Kunyomi</div>
        <div className="mt-1">{formatReadings(item.kunyomi)}</div>
      </td>
      <td className="py-4 align-top text-sm text-text-primary">{item.meaning || 'No meaning provided.'}</td>
      <td className="py-4 pl-4 align-top text-right">
        <button
          type="button"
          onClick={() => navigate(`/kanji/${item.id}`, { state: { item } })}
          className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary dark:border-gray-700"
        >
          See more
        </button>
      </td>
    </tr>
  )
}

export default function Kanji() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('cards')
  const [activeLevel, setActiveLevel] = useState('all')

  useEffect(() => {
    let isActive = true

    const loadKanji = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await apiClient.get('/kanji/list', { params: { limit: 100 } })

        if (!isActive) {
          return
        }

        setItems(Array.isArray(response.data?.items) ? response.data.items : [])
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Failed to load kanji')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadKanji()

    return () => {
      isActive = false
    }
  }, [])

  const filteredItems = useMemo(
    () => items.filter((item) => activeLevel === 'all' || String(item.jlpt_level ?? '') === activeLevel),
    [items, activeLevel],
  )

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((left, right) => {
      const leftLevel = String(left.jlpt_level ?? '0')
      const rightLevel = String(right.jlpt_level ?? '0')

      const levelCompare = JLPT_ORDER.indexOf(leftLevel) - JLPT_ORDER.indexOf(rightLevel)
      if (levelCompare !== 0) {
        return levelCompare
      }

      const rankCompare = (left.frequency_rank ?? 99999) - (right.frequency_rank ?? 99999)
      if (rankCompare !== 0) {
        return rankCompare
      }

      return left.kanji.localeCompare(right.kanji, 'ja')
    })
  }, [filteredItems])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl text-text-primary md:text-4xl">Kanji 漢字</h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary md:text-base">
              Browse kanji in card or list form and sort them by JLPT level from N5 to N1.
            </p>
          </div>

          <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Visible</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">{sortedItems.length}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full rounded-2xl bg-surface p-1 shadow-sm sm:w-fit">
            {VIEW_MODES.map((mode) => {
              const isActive = viewMode === mode.key

              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setViewMode(mode.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-primary text-text-inverse shadow-sm' : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'}`}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>

          <div className="inline-flex w-full flex-wrap gap-2 rounded-2xl bg-surface p-1 shadow-sm sm:w-fit">
            {JLPT_LEVELS.map((level) => {
              const isActive = activeLevel === level.key

              return (
                <button
                  key={level.key}
                  type="button"
                  onClick={() => setActiveLevel(level.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-primary text-text-inverse shadow-sm' : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'}`}
                >
                  {level.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading kanji...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          No kanji found for the selected level.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((item) => (
            <KanjiCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-bg-card shadow-sm dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-surface/70 text-left text-xs uppercase tracking-[0.2em] text-text-muted">
                <tr>
                  <th className="px-5 py-4">Kanji</th>
                  <th className="px-5 py-4">Level</th>
                  <th className="px-5 py-4">Readings</th>
                  <th className="px-5 py-4">Meaning</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <KanjiRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
