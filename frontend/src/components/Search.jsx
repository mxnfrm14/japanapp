import React, { useEffect, useRef, useState } from 'react'
import { useSearch } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'

export default function Search({ query, isOpen, onClose, anchorRef }) {
	const navigate = useNavigate()
	const { data = [], isLoading } = useSearch(query, { limit: 20 })
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const containerRef = useRef(null)
	const hasResults = Array.isArray(data) && data.length > 0

	// Reset the highlighted row during render (rather than in an effect) whenever
	// the panel opens/closes or a new set of results comes in.
	const resultsKey = `${isOpen}|${query}|${hasResults}|${isLoading}`
	const [prevResultsKey, setPrevResultsKey] = useState(resultsKey)
	if (prevResultsKey !== resultsKey) {
		setPrevResultsKey(resultsKey)
		if (!isOpen) {
			setSelectedIndex(-1)
		} else if (hasResults) {
			setSelectedIndex(0)
		} else if (!isLoading) {
			setSelectedIndex(-1)
		}
	}

	useEffect(() => {
		const handleKey = (e) => {
			if (!isOpen) return
			if (e.key === 'Escape') {
				onClose?.()
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				setSelectedIndex((i) => Math.min(i + 1, (data?.length || 0) - 1))
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				setSelectedIndex((i) => Math.max(i - 1, 0))
			} else if (e.key === 'Enter') {
				e.preventDefault()
				const item = data?.[selectedIndex]
				if (item) {
					const path = item.type === 'kanji' ? `/kanji/${item.id}` : `/vocabulary/${item.id}`
					navigate(path, { state: { item } })
					onClose?.()
				}
			}
		}

		window.addEventListener('keydown', handleKey)
		return () => window.removeEventListener('keydown', handleKey)
	}, [isOpen, data, selectedIndex, navigate, onClose])

	useEffect(() => {
		const onClick = (e) => {
			if (!containerRef.current) return
			if (!containerRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) {
				onClose?.()
			}
		}
		document.addEventListener('mousedown', onClick)
		return () => document.removeEventListener('mousedown', onClick)
	}, [onClose, anchorRef])

	if (!isOpen) return null

	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

	const handleSelect = (item) => {
		const path = item.type === 'kanji' ? `/kanji/${item.id}` : `/vocabulary/${item.id}`
		navigate(path, { state: { item } })
		onClose?.()
	}

	return (
		<div
			ref={containerRef}
			className={`z-50 ${isMobile ? 'fixed inset-x-0 top-16 bottom-0 bg-bg p-4' : 'absolute left-0 right-0 top-full mt-2 w-full'}`}
		>
			<div className="overflow-hidden rounded-lg border border-gray-200 bg-surface shadow-sm dark:border-gray-700">
				{isLoading ? (
					<div className="p-4 text-center text-text-secondary">Searching...</div>
				) : !hasResults ? (
					<div className="p-4 text-text-secondary">No results</div>
				) : (
					<ul role="listbox" className="max-h-80 overflow-auto">
						{data.map((item, idx) => (
							<li
								key={`${item.type}-${item.id}`}
								role="option"
								aria-selected={selectedIndex === idx}
								onMouseEnter={() => setSelectedIndex(idx)}
								onClick={() => handleSelect(item)}
								className={`px-4 py-3 cursor-pointer hover:bg-bg-card ${selectedIndex === idx ? 'bg-bg-card' : ''}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<div className="font-display text-lg">{item.japanese}</div>
										<div className="text-sm text-text-secondary">
											{item.reading || ''}
											{item.meaning ? ` • ${item.meaning}` : ''}
										</div>
									</div>
									<div className="text-xs text-text-muted">
										{item.type === 'kanji' ? 'K' : item.type === 'kana' ? 'KA' : 'V'}
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}
