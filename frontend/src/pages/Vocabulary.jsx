import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../services/api'

const VIEW_MODES = [
  { key: 'cards', label: 'Card view' },
  { key: 'list', label: 'List view' },
]

const SORT_MODES = [
  { key: 'level', label: 'Level' },
  { key: 'tags', label: 'Tags' },
]

function VocabularyItemCard({ item }) {
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
    </article>
  )
}

function VocabularyItemRow({ item }) {
  return (
    <tr className="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
      <td className="py-4 pr-4 align-top">
        <div className="font-display text-2xl text-text-primary">{item.japanese}</div>
      </td>
      <td className="py-4 pr-4 align-top text-sm text-text-secondary">{item.reading || '—'}</td>
      <td className="py-4 pr-4 align-top text-sm text-text-primary">{item.meaning || 'No meaning provided.'}</td>
      <td className="py-4 pr-4 align-top">
        <div className="flex flex-wrap gap-2">
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
            <span className="text-sm text-text-muted">No tags</span>
          )}
        </div>
      </td>
      <td className="py-4 pr-4 align-top text-sm font-medium text-text-primary">{item.difficulty_level ?? '—'}</td>
      <td className="py-4 align-top text-sm text-text-muted">#{item.frequency_rank ?? '—'}</td>
    </tr>
  )
}

export default function Vocabulary() {
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('cards')
  const [sortMode, setSortMode] = useState('level')
  const [activeTag, setActiveTag] = useState('all')

  useEffect(() => {
    let isActive = true

    const loadVocabulary = async () => {
      setIsLoading(true)
      setError('')

      try {
        const [listResponse, tagsResponse] = await Promise.all([
          apiClient.get('/vocabulary/list', { params: { limit: 100} }),
          apiClient.get('/vocabulary/tags'),
        ])

        if (!isActive) {
          return
        }

        setItems(Array.isArray(listResponse.data?.items) ? listResponse.data.items : [])
        setTags(Array.isArray(tagsResponse.data?.tags) ? tagsResponse.data.tags : [])
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Failed to load vocabulary')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadVocabulary()

    return () => {
      isActive = false
    }
  }, [])

  const filteredItems = useMemo(
    () => items.filter((item) => activeTag === 'all' || (item.tags || []).includes(activeTag)),
    [items, activeTag],
  )

  const sortedItems = useMemo(() => {
    const decoratedItems = filteredItems.map((item) => ({
      item,
      primaryTag: (item.tags || [])[0] || '',
    }))

    decoratedItems.sort((left, right) => {
      if (sortMode === 'tags') {
        const tagCompare = left.primaryTag.localeCompare(right.primaryTag, 'en', { sensitivity: 'base' })
        if (tagCompare !== 0) {
          return tagCompare
        }
      } else {
        const levelCompare = (right.item.difficulty_level ?? 0) - (left.item.difficulty_level ?? 0)
        if (levelCompare !== 0) {
          return levelCompare
        }
      }

      const rankCompare = (left.item.frequency_rank ?? 99999) - (right.item.frequency_rank ?? 99999)
      if (rankCompare !== 0) {
        return rankCompare
      }

      return left.item.japanese.localeCompare(right.item.japanese, 'ja')
    })

    return decoratedItems.map(({ item }) => item)
  }, [filteredItems, sortMode])

  const levelCounts = useMemo(() => {
    return sortedItems.reduce((accumulator, item) => {
      const level = String(item.difficulty_level ?? 'unknown')
      accumulator[level] = (accumulator[level] || 0) + 1
      return accumulator
    }, {})
  }, [sortedItems])

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
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Items</div>
              <div className="mt-1 text-lg font-semibold text-text-primary">{sortedItems.length}</div>
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

          <div className="inline-flex w-full rounded-2xl bg-surface p-1 shadow-sm sm:w-fit">
            {SORT_MODES.map((mode) => {
              const isActive = sortMode === mode.key

              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setSortMode(mode.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-primary text-text-inverse shadow-sm' : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'}`}
                >
                  Sort by {mode.label}
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

      {isLoading ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading vocabulary...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((item) => (
            <VocabularyItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-bg-card shadow-sm dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-surface/70 text-left text-xs uppercase tracking-[0.2em] text-text-muted">
                <tr>
                  <th className="px-5 py-4">Japanese</th>
                  <th className="px-5 py-4">Reading</th>
                  <th className="px-5 py-4">Meaning</th>
                  <th className="px-5 py-4">Tags</th>
                  <th className="px-5 py-4">Level</th>
                  <th className="px-5 py-4">Rank</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <VocabularyItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
