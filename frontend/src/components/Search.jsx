import { useEffect, useLayoutEffect, useRef } from 'react'
import { MagnifyingGlassIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { useFavoriteItems } from '../hooks/useFavorites'
import FavoriteButton from './FavoriteButton'
import FavoritesNotice from './FavoritesNotice'

const TYPE_LABELS = { vocabulary: 'Vocabulary', kanji: 'Kanji', kana: 'Kana' }

export default function Search({ id, query, data, isLoading, selectedIndex, onHighlight, onSelect }) {
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const vocabularyFavorites = useFavoriteItems('vocabulary', data.filter((item) => item.type === 'vocabulary').map((item) => item.id))
  const kanjiFavorites = useFavoriteItems('kanji', data.filter((item) => item.type === 'kanji').map((item) => item.id))

  useLayoutEffect(() => {
    const fitPanel = () => {
      const panel = panelRef.current
      if (!panel) return
      const viewport = window.visualViewport
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      const bottomGap = window.matchMedia('(max-width: 767px)').matches ? 112 : 16
      const height = Math.max(0, bottom - panel.getBoundingClientRect().top - bottomGap)
      panel.style.setProperty('--search-available-height', `${height}px`)
    }
    fitPanel()
    window.addEventListener('resize', fitPanel)
    window.addEventListener('scroll', fitPanel, true)
    window.visualViewport?.addEventListener('resize', fitPanel)
    window.visualViewport?.addEventListener('scroll', fitPanel)
    return () => {
      window.removeEventListener('resize', fitPanel)
      window.removeEventListener('scroll', fitPanel, true)
      window.visualViewport?.removeEventListener('resize', fitPanel)
      window.visualViewport?.removeEventListener('scroll', fitPanel)
    }
  }, [])

  useEffect(() => {
    const list = listRef.current
    const row = list?.children[selectedIndex]
    if (!row) return
    // Scroll the list itself, leaving the Home page and search input in place.
    const listRect = list.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    if (rowRect.top < listRect.top) list.scrollTop -= listRect.top - rowRect.top
    else if (rowRect.bottom > listRect.bottom) list.scrollTop += rowRect.bottom - listRect.bottom
  }, [selectedIndex, data])

  return (
    <div ref={panelRef} className="search-results">
      <div className="search-results-heading">
        <span>Dictionary</span>
        {!isLoading && <span>{data.length} {data.length === 1 ? 'result' : 'results'}</span>}
      </div>
      {(vocabularyFavorites.error || kanjiFavorites.error) && (
        <div className="search-favorites-notices">
          <FavoritesNotice favorites={vocabularyFavorites} />
          <FavoritesNotice favorites={kanjiFavorites} />
        </div>
      )}
      <ul
        ref={listRef}
        id={id}
        role="listbox"
        aria-label="Search results"
        aria-busy={isLoading}
        className="search-results-list"
      >
        {!isLoading && data.map((item, index) => (
          <li
            key={`${item.type}-${item.id}`}
            role="presentation"
            className={`search-result ${selectedIndex === index ? 'search-result-selected' : ''}`}
            onMouseEnter={() => onHighlight(index)}
            onMouseDown={(event) => {
              if (!event.target.closest('button')) event.preventDefault()
            }}
            onClick={() => onSelect(item)}
          >
            <div
              id={`${id}-${index}`}
              role="option"
              aria-selected={selectedIndex === index}
              className="search-result-content"
            >
              <div className="search-result-title">
                <span className="search-result-japanese" lang="ja">{item.japanese}</span>
                <span className="search-result-type">{TYPE_LABELS[item.type] || item.type}</span>
              </div>
              {item.reading && <div className="search-result-reading" lang="ja">{item.reading}</div>}
              {item.meaning && <div className="search-result-meaning">{item.meaning}</div>}
            </div>
            {(item.type === 'kanji' || item.type === 'vocabulary') && (
              <FavoriteButton {...(item.type === 'kanji' ? kanjiFavorites : vocabularyFavorites).forItem(item.id)} />
            )}
          </li>
        ))}
      </ul>
      {isLoading ? (
        <div className="search-results-state" role="status">
          <SpinnerGapIcon className="search-spinner" size={24} aria-hidden="true" />
          <span>Searching the dictionary…</span>
        </div>
      ) : !data.length ? (
        <div className="search-results-state" role="status">
          <MagnifyingGlassIcon size={24} aria-hidden="true" />
          <strong>No results for “{query}”</strong>
          <span>Try another word, kanji, or reading.</span>
        </div>
      ) : <span className="sr-only" role="status">{data.length} results available.</span>}
      <div className="search-results-footer" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Open</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  )
}
