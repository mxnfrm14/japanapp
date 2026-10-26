import { BookmarkSimpleIcon } from '@phosphor-icons/react'

export default function FavoriteButton({ saved = false, disabled = false, onToggle }) {
  const label = saved ? 'Remove from favorites' : 'Add to favorites'
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={saved}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-surface p-3 shadow-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${saved ? 'text-primary' : 'text-text-secondary'}`}
    >
      <BookmarkSimpleIcon size={20} weight={saved ? 'fill' : 'regular'} aria-hidden="true" />
    </button>
  )
}
