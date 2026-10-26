import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'

export default function SessionExpiryDialog() {
  const dialogRef = useRef(null)
  const { session, isRenewalPending, isRefreshing, requestSessionExtension, extendSession, signOut } = useAuthStore()

  useEffect(() => {
    if (!session?.expires_at) return

    let timer
    const checkExpiry = () => {
      clearTimeout(timer)
      const remaining = session.expires_at * 1000 - Date.now()
      if (remaining <= 0) {
        void requestSessionExtension()
      } else {
        timer = setTimeout(checkExpiry, Math.min(remaining, 2 ** 31 - 1))
      }
    }

    checkExpiry()
    window.addEventListener('focus', checkExpiry)
    document.addEventListener('visibilitychange', checkExpiry)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', checkExpiry)
      document.removeEventListener('visibilitychange', checkExpiry)
    }
  }, [session, requestSessionExtension])

  useEffect(() => {
    const dialog = dialogRef.current
    if (isRenewalPending && !dialog.open) dialog.showModal()
    if (!isRenewalPending && dialog.open) dialog.close()
  }, [isRenewalPending])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
      onCancel={(event) => { event.preventDefault(); void signOut() }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-6 text-text-primary shadow-xl backdrop:bg-black/60"
    >
      <h2 id="session-expired-title" className="mt-0 text-2xl font-bold">Session expired</h2>
      <p id="session-expired-description" className="text-sm text-text-secondary">
        Would you like to extend your session and continue where you left off?
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={extendSession}
          disabled={isRefreshing}
          className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-50"
        >
          {isRefreshing ? 'Extending session...' : 'Extend session'}
        </button>
        <button type="button" onClick={() => signOut()} className="rounded-md border border-border px-4 py-2 font-medium hover:bg-hover">
          Sign out
        </button>
      </div>
    </dialog>
  )
}
