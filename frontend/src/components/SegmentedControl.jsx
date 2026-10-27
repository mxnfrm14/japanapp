import { useId } from 'react'

export default function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  const name = useId()
  const selectedIndex = options.findIndex((option) => option.value === value)

  if (options.length === 0) return null

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`min-w-0 rounded-2xl bg-surface-raised p-1 shadow-sm ${className}`}>
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {selectedIndex >= 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-primary shadow-sm transition-transform duration-250 ease-out motion-reduce:transition-none"
            style={{ width: `${100 / options.length}%`, transform: `translateX(${selectedIndex * 100}%)` }}
          />
        ) : null}
        {options.map((option) => (
          <label key={option.value} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-semibold transition-colors duration-250 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary motion-reduce:transition-none ${option.value === value ? 'text-white' : 'text-text-secondary hover:text-text-primary'}`}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
