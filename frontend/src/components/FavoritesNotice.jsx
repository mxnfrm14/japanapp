export default function FavoritesNotice({ favorites }) {
  if (!favorites.error) return null
  return (
    <div role="alert" className="my-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      <span>Could not load or update favorites.</span>
      <button type="button" onClick={favorites.retry} className="font-semibold underline">Try again</button>
    </div>
  )
}
