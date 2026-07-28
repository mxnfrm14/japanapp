import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useInfiniteVocabulary, useFetchVocabularyTags } from '../hooks/useApi'

const PAGE_SIZE = 50

const VIEW_MODES = [
  { key: 'cards', label: 'Card view' },
  { key: 'list', label: 'List view' },
]

// Keys are the sort direction on `difficulty_level`, where 5 is N5 (easiest).
const LEVEL_ORDERS = [
  { key: 'desc', icon: ArrowDownIcon, label: 'Easiest first (N5 → N1)' },
  { key: 'asc', icon: ArrowUpIcon, label: 'Hardest first (N1 → N5)' },
]

function VocabularyItemCard({ item }) {
  const navigate = useNavigate()

  return (
    <article className="flex h-full flex-col rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-3xl text-text-primary md:text-4xl">{item.japanese}</div>
          <div className="mt-1 text-sm text-text-secondary">{item.reading || '—'}</div>
        </div>

        <div className="badge badge-lg badge-primary">N{item.difficulty_level ?? '—'}</div>
          
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-text-primary">{item.meaning || 'No meaning provided.'}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(item.tags || []).length > 0 ? (
          item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-gray-200 bg-surface px-3 py-1 text-xs font-medium text-text-secondary dark:border-gray-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs font-medium text-text-muted dark:border-gray-600">
            No tags
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
        <span>Rank #{item.frequency_rank ?? '—'}</span>
        <span>{item.reading ? `${item.reading}` : 'Reading unavailable'}</span>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/vocabulary/${item.id}`, { state: { item } })}
        className="mt-5 inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary dark:border-gray-700"
      >
        See more
      </button>
    </article>
  )
}

const VISIBLE_ROW_TAGS = 3

function VocabularyItemRow({ item }) {
  const navigate = useNavigate()

  const openDetail = () => navigate(`/vocabulary/${item.id}`, { state: { item } })

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  const itemTags = item.tags || []
  const hiddenTagCount = itemTags.length - VISIBLE_ROW_TAGS

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${item.japanese}`}
      className="group cursor-pointer transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
    >
      <td className="w-px min-w-[16rem] whitespace-nowrap px-6 py-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl leading-tight text-text-primary">{item.japanese}</span>
          <CaretRightIcon
            size={16}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100"
          />
        </div>
        <div className="mt-0.5 text-sm text-text-secondary">{item.reading || '—'}</div>
      </td>

      <td className="px-6 py-4 align-middle text-sm leading-6 text-text-primary">
        {item.meaning || <span className="text-text-muted">No meaning provided.</span>}
      </td>

      <td className="px-6 py-4 align-middle">
        <div className="flex flex-wrap items-center gap-1.5">
          {itemTags.length > 0 ? (
            <>
              {itemTags.slice(0, VISIBLE_ROW_TAGS).map((tag) => (
                <span
                  key={tag}
                  className="whitespace-nowrap rounded-full border border-gray-200 bg-surface px-2.5 py-0.5 text-xs font-medium text-text-secondary dark:border-gray-700"
                >
                  {tag}
                </span>
              ))}
              {hiddenTagCount > 0 ? (
                <span className="text-xs font-medium text-text-muted">+{hiddenTagCount}</span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-text-muted">—</span>
          )}
        </div>
      </td>

      <td className="px-6 py-4 align-middle">
        <span className="badge badge-primary badge-sm whitespace-nowrap">N{item.difficulty_level ?? '—'}</span>
      </td>

      <td className="px-6 py-4 text-right align-middle text-sm tabular-nums text-text-muted">
        {item.frequency_rank ? `#${item.frequency_rank}` : '—'}
      </td>
    </tr>
  )
}

export default function Vocabulary() {
  const [viewMode, setViewMode] = useState('cards')
  const [levelOrder, setLevelOrder] = useState('desc')
  const [activeTag, setActiveTag] = useState('all')

  const tagsQuery = useFetchVocabularyTags()

  // Ordering and tag filtering happen server-side: changing either swaps the query
  // key, which discards loaded pages and refetches from page 1.
  const {
    data,
    error,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteVocabulary({
    limit: PAGE_SIZE,
    order: levelOrder,
    tag: activeTag === 'all' ? undefined : activeTag,
  })

  const loadedItems = useMemo(() => (data?.pages ?? []).flatMap((page) => page?.items ?? []), [data])

  const tags = useMemo(
    () => (Array.isArray(tagsQuery.data?.tags) ? tagsQuery.data.tags : []),
    [tagsQuery.data],
  )

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

  const levelCounts = useMemo(() => {
    return loadedItems.reduce((accumulator, item) => {
      const level = String(item.difficulty_level ?? 'unknown')
      accumulator[level] = (accumulator[level] || 0) + 1
      return accumulator
    }, {})
  }, [loadedItems])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl text-text-primary md:text-4xl">Vocabulary 単語</h1>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary md:text-base">
              Browse vocabulary in card or list form, then sort by JLPT-style level or by tags.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-3">
            <div className="rounded-2xl bg-surface px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Loaded</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">
                {loadedItems.length}
                {hasNextPage ? '+' : ''}
              </div>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Levels</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">{Object.keys(levelCounts).length}</div>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Tags</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">{tags.length}</div>
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

          <div className="inline-flex w-full items-center gap-1 rounded-2xl bg-surface p-1 shadow-sm sm:w-fit">
            <span className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Level</span>
            {LEVEL_ORDERS.map((order) => {
              const isActive = levelOrder === order.key
              const Icon = order.icon

              return (
                <button
                  key={order.key}
                  type="button"
                  onClick={() => setLevelOrder(order.key)}
                  title={order.label}
                  aria-label={order.label}
                  aria-pressed={isActive}
                  className={`rounded-xl p-2.5 transition-all ${isActive ? 'bg-primary text-text-inverse shadow-sm' : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'}`}
                >
                  <Icon size={18} weight="bold" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:max-w-sm">
          <label htmlFor="tag-filter" className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Tag filter
          </label>
          <select
            id="tag-filter"
            value={activeTag}
            onChange={(event) => setActiveTag(event.target.value)}
            className="rounded-2xl border border-gray-200 bg-bg-card px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition-colors focus:border-primary dark:border-gray-700"
          >
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading vocabulary...
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error instanceof Error ? error.message : 'Failed to load vocabulary'}
        </div>
      ) : loadedItems.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          No vocabulary matches this filter.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loadedItems.map((item) => (
            <VocabularyItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-bg-card shadow-sm dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="border-b border-gray-200 bg-surface/70 text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-muted dark:border-gray-700">
                <tr>
                  <th scope="col" className="w-px min-w-[16rem] whitespace-nowrap px-6 py-3.5 font-semibold">Word</th>
                  <th scope="col" className="w-full px-6 py-3.5 font-semibold">Meaning</th>
                  <th scope="col" className="whitespace-nowrap px-6 py-3.5 font-semibold">Tags</th>
                  <th scope="col" className="whitespace-nowrap px-6 py-3.5 font-semibold">Level</th>
                  <th scope="col" className="whitespace-nowrap px-6 py-3.5 text-right font-semibold">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loadedItems.map((item) => (
                  <VocabularyItemRow key={item.id} item={item} />
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
