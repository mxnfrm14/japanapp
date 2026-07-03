import React, { useEffect, useRef, useState } from "react";
import { SunIcon, MoonIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import Search from './Search'


export default function TopNavBar({ isExpanded = true }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div 
      className={`fixed top-0 right-0 z-50 transition-all duration-300 ease-in-out bg-transparent backdrop-blur-md left-0 md:left-[104px] ${isExpanded ? 'lg:left-[280px]' : 'lg:left-[104px]'}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center px-4 md:px-8 lg:px-12 py-3 md:py-4">
        <div className="hidden md:flex items-center gap-4">
          <div className="relative flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 w-full max-w-sm transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 focus-within:shadow-inner">
            <MagnifyingGlassIcon size={20} weight="bold" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vocabulary, kanji, or reading"
              className="bg-transparent border-none outline-none text-text-primary placeholder-text-muted w-full"
              aria-label="Search"
            />
            <Search query={debouncedQuery} isOpen={debouncedQuery.length > 0} onClose={() => { setQuery(''); setDebouncedQuery('') }} anchorRef={inputRef} />
          </div>
        </div>

        
      </div>
    </div>
  );
}
