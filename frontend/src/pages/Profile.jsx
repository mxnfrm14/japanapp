import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkSimpleIcon, GearIcon, UserIcon } from '@phosphor-icons/react'
import { useAuthStore } from '../stores/authStore'
import { useFavoriteMutation, useFavoritesList } from '../hooks/useFavorites'
import FavoriteButton from '../components/FavoriteButton'
import FavoritesNotice from '../components/FavoritesNotice'

const FILTERS = [
  { key: 'all', label: 'All favorites' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'kanji', label: 'Kanji' },
]

export default function Profile() {
  const user = useAuthStore((state) => state.user)
  const [filter, setFilter] = useState('all')
  const favorites = useFavoritesList(filter === 'all' ? undefined : filter)
  const mutation = useFavoriteMutation()
  const items = (favorites.data?.pages ?? []).flatMap((page) => page.items)
  const displayName = user?.display_name || user?.user_metadata?.display_name || 'Your profile'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-gray-200 bg-bg-card p-6 shadow-sm dark:border-gray-700 md:p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-primary">
          <UserIcon size={32} weight="bold" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl text-text-primary">{displayName}</h1>
          <p className="mt-1 break-all text-sm text-text-secondary">{user?.email}</p>
        </div>
        <Link to="/settings" className="inline-flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-text-primary hover:text-primary">
          <GearIcon size={20} /> Settings
        </Link>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
        <div className="flex items-center gap-3">
          <BookmarkSimpleIcon size={24} weight="fill" className="text-primary" />
          <h2 className="font-display text-2xl text-text-primary">Favorites</h2>
        </div>
        <p className="mt-2 text-sm text-text-secondary">Your saved words and kanji, ready to revisit.</p>
        <div className="my-5 flex flex-wrap gap-2" aria-label="Filter favorites">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${filter === key ? 'bg-primary text-text-inverse' : 'bg-surface text-text-secondary hover:text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <FavoritesNotice favorites={favorites} />
        <FavoritesNotice favorites={mutation} />
        {favorites.error && !items.length ? null : favorites.isPending ? (
          <p role="status" className="py-8 text-center text-text-secondary">Loading favorites...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center">
            <BookmarkSimpleIcon size={36} className="mx-auto text-text-muted" />
            <p className="mt-3 font-semibold text-text-primary">No favorites yet</p>
            <p className="mt-2 text-sm text-text-secondary">Tap the bookmark on a word or kanji to save it here.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm font-semibold text-primary">
              <Link to="/vocabulary">Browse vocabulary</Link>
              <Link to="/kanji">Browse kanji</Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <li key={`${item.item_type}:${item.item_id}`} className="flex items-center gap-3 py-4">
                <Link to={`/${item.item_type}/${item.item_id}`} className="min-w-0 flex-1 rounded-xl p-2 transition-colors hover:bg-surface">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-cjk text-3xl text-text-primary">{item.japanese}</span>
                    <span className="text-xs text-text-muted">{item.item_type === 'kanji' ? 'Kanji' : 'Vocabulary'}</span>
                    {item.jlpt_level && <span className="badge badge-primary badge-sm">N{item.jlpt_level}</span>}
                  </div>
                  {item.reading && <p className="mt-1 text-sm text-text-secondary">{item.reading}</p>}
                  <p className="mt-2 text-sm text-text-primary">{item.meaning || 'No meaning provided.'}</p>
                </Link>
                <FavoriteButton {...mutation.forItem(item.item_type, item.item_id, true)} />
              </li>
            ))}
          </ul>
        )}
        {favorites.hasNextPage && (
          <button
            type="button"
            onClick={() => favorites.fetchNextPage()}
            disabled={favorites.isFetchingNextPage}
            className="mt-5 w-full rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-primary disabled:opacity-40"
          >
            {favorites.isFetchingNextPage ? 'Loading...' : 'Load more favorites'}
          </button>
        )}
      </section>
    </div>
  )
}
