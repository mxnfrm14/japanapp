import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useInfiniteKanji } from '../hooks/useApi'

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

const PAGE_SIZE = 50

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

const VISIBLE_ROW_READINGS = 4

/** One reading group (on'yomi or kun'yomi) rendered as pills, like the vocabulary tag column. */
function ReadingPills({ label, readings }) {
  const values = Array.isArray(readings) ? readings : []

  if (values.length === 0) {
    return null
  }

  const hiddenCount = values.length - VISIBLE_ROW_READINGS

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-9 shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</span>
      {values.slice(0, VISIBLE_ROW_READINGS).map((reading) => (
        <span
          key={`${label}-${reading}`}
          className="whitespace-nowrap rounded-full border border-gray-200 bg-surface px-2.5 py-0.5 font-cjk text-xs font-medium text-text-secondary dark:border-gray-700"
        >
          {reading}
        </span>
      ))}
      {hiddenCount > 0 ? <span className="text-xs font-medium text-text-muted">+{hiddenCount}</span> : null}
    </div>
  )
}

function KanjiRow({ item }) {
  const navigate = useNavigate()

  const openDetail = () => navigate(`/kanji/${item.id}`, { state: { item } })

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  const hasReadings = (item.onyomi || []).length > 0 || (item.kunyomi || []).length > 0

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${item.kanji}`}
      className="group cursor-pointer transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
    >
      <td className="w-px whitespace-nowrap px-6 py-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="font-cjk text-3xl leading-tight text-text-primary">{item.kanji}</span>
          <CaretRightIcon
            size={16}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100"
          />
        </div>
      </td>

      <td className="px-6 py-4 align-middle text-sm leading-6 text-text-primary">
        {item.meaning || <span className="text-text-muted">No meaning provided.</span>}
      </td>

      <td className="min-w-[22rem] px-6 py-4 align-middle">
        {hasReadings ? (
          <div className="flex flex-col gap-1.5">
            <ReadingPills label="On" readings={item.onyomi} />
            <ReadingPills label="Kun" readings={item.kunyomi} />
          </div>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </td>

      <td className="px-6 py-4 align-middle">
        <span className="badge badge-primary badge-sm whitespace-nowrap">N{item.jlpt_level ?? '—'}</span>
      </td>

      <td className="px-6 py-4 text-right align-middle text-sm tabular-nums text-text-muted">
        {item.frequency_rank ? `#${item.frequency_rank}` : '—'}
      </td>
    </tr>
  )
}

export default function Kanji() {
  const [viewMode, setViewMode] = useState('cards')
  const [activeLevel, setActiveLevel] = useState('all')

  // Level filtering happens server-side: changing it swaps the query key, which
  // discards loaded pages and refetches from page 1. The backend orders by
  // frequency rank, so there is nothing to re-sort on the client.
  const {
    data,
    error,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteKanji({
    limit: PAGE_SIZE,
    jlptLevel: activeLevel === 'all' ? undefined : activeLevel,
  })

  const loadedItems = useMemo(() => (data?.pages ?? []).flatMap((page) => page?.items ?? []), [data])

  const sentinelRef = useRef(null)

  // Start the next page while the sentinel is still below the fold so the list
  // keeps growing before the user actually reaches the end.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage()
        }
      },
      { rootMargin: '800px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, viewMode])

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
            <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Loaded</div>
            <div className="mt-1 text-lg font-semibold text-text-primary">
              {loadedItems.length}
              {hasNextPage ? '+' : ''}
            </div>
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

      {isPending ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading kanji...
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error instanceof Error ? error.message : 'Failed to load kanji'}
        </div>
      ) : loadedItems.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          No kanji found for the selected level.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loadedItems.map((item) => (
            <KanjiCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-bg-card shadow-sm dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="border-b border-gray-200 bg-surface/70 text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-muted dark:border-gray-700">
                <tr>
                  <th scope="col" className="w-px whitespace-nowrap px-6 py-3.5 font-semibold">Kanji</th>
                  <th scope="col" className="w-full px-6 py-3.5 font-semibold">Meaning</th>
                  <th scope="col" className="min-w-[22rem] whitespace-nowrap px-6 py-3.5 font-semibold">Readings</th>
                  <th scope="col" className="whitespace-nowrap px-6 py-3.5 font-semibold">Level</th>
                  <th scope="col" className="whitespace-nowrap px-6 py-3.5 text-right font-semibold">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loadedItems.map((item) => (
                  <KanjiRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isPending && !isError ? (
        <div ref={sentinelRef} className="py-8 text-center text-sm text-text-muted">
          {isFetchingNextPage
            ? 'Loading more...'
            : hasNextPage
              ? 'Scroll for more'
              : loadedItems.length > 0
                ? 'End of list'
                : null}
        </div>
      ) : null}
    </div>
  )
}
