import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { useSearch } from '../hooks/useApi'
import Search from './Search'
import './Search.css'

const EMPTY_RESULTS = []

export default function SearchField({ className = '', shortcut = false }) {
  const navigate = useNavigate()
  const resultsId = useId()
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const timerRef = useRef(null)
  const composingRef = useRef(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [selection, setSelection] = useState({ query: '', index: 0 })

  // Never show or select results belonging to the text before the latest edit.
  const trimmedQuery = query.trim()
  const isDebouncing = trimmedQuery !== debouncedQuery
  const searchQuery = !isDebouncing && !isComposing ? debouncedQuery : ''
  const { data = EMPTY_RESULTS, isLoading } = useSearch(searchQuery, { limit: 20 })
  const results = searchQuery ? data : EMPTY_RESULTS
  const isOpen = isActive && !!trimmedQuery && !isComposing
  const selectedIndex = results.length
    ? Math.min(selection.query === searchQuery ? selection.index : 0, results.length - 1)
    : -1

  useEffect(() => {
    if (isComposing) return
    timerRef.current = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timerRef.current)
  }, [query, isComposing])

  useEffect(() => {
    if (!isActive) return
    const dismissOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsActive(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [isActive])

  useEffect(() => {
    // Both fields remain mounted on Home, but only the visible one may open.
    const media = window.matchMedia('(min-width: 768px)')
    const dismissOnResize = () => setIsActive(false)
    media.addEventListener('change', dismissOnResize)
    return () => media.removeEventListener('change', dismissOnResize)
  }, [])

  useEffect(() => {
    if (!shortcut) return
    const focusSearch = (event) => {
      if (
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' &&
        !event.altKey && !event.isComposing &&
        window.matchMedia('(min-width: 768px)').matches
      ) {
        event.preventDefault()
        inputRef.current?.focus()
        setIsActive(true)
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [shortcut])

  const clearSearch = () => {
    window.clearTimeout(timerRef.current)
    composingRef.current = false
    setIsComposing(false)
    setQuery('')
    setDebouncedQuery('')
    setSelection({ query: '', index: 0 })
  }

  const selectResult = (item) => {
    const path = item.type === 'kanji' ? `/kanji/${item.id}` : `/vocabulary/${item.id}`
    clearSearch()
    setIsActive(false)
    navigate(path, { state: { item } })
  }

  const handleKeyDown = (event) => {
    // Some IMEs send the confirming Enter just after compositionend (keyCode 229).
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsActive(false)
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && trimmedQuery) {
      event.preventDefault()
      setIsActive(true)
      const nextIndex = !isOpen ? 0 : selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)
      setSelection({ query: searchQuery, index: Math.max(0, Math.min(nextIndex, results.length - 1)) })
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault()
      if (results[selectedIndex]) selectResult(results[selectedIndex])
    }
  }

  return (
    <div
      ref={containerRef}
      className={`search-field ${className}`}
      role="search"
      aria-label="Search Japanese"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsActive(false)
      }}
    >
      <div className="search-input-shell">
        <MagnifyingGlassIcon className="search-input-icon" size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          placeholder={shortcut ? 'Search vocabulary, kanji, or reading' : 'Find a word or kanji…'}
          aria-label="Search vocabulary, kanji, or reading"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? resultsId : undefined}
          aria-activedescendant={isOpen && selectedIndex >= 0 ? `${resultsId}-${selectedIndex}` : undefined}
          aria-keyshortcuts={shortcut ? 'Control+k Meta+k' : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsActive(true)
            setSelection({ query: '', index: 0 })
            if (!event.target.value.trim()) clearSearch()
          }}
          onFocus={() => setIsActive(true)}
          onClick={() => setIsActive(true)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true
            window.clearTimeout(timerRef.current)
            setIsComposing(true)
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false
            setIsComposing(false)
            setQuery(event.currentTarget.value)
          }}
        />
        {shortcut && !query && (
          <span className="search-shortcut" aria-hidden="true">
            <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
          </span>
        )}
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            title="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              clearSearch()
              inputRef.current?.focus()
            }}
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
      {isOpen && (
        <Search
          id={resultsId}
          query={trimmedQuery}
          data={results}
          isLoading={isDebouncing || isLoading}
          selectedIndex={selectedIndex}
          onHighlight={(index) => setSelection({ query: searchQuery, index })}
          onSelect={selectResult}
        />
      )}
    </div>
  )
}
