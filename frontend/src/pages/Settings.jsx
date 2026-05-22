import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuthStore } from '../stores/authStore'

export default function Settings() {
  const { dark, setDark } = useTheme()

  const { signOut, isLoading } = useAuthStore()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-(--color-text-primary)">Settings</h1>
      <div className="mt-4 rounded-xl p-4 bg-(--bg-card)">
        <label className="flex items-center gap-3">
          <span className="text-(--color-text-primary)">Dark mode</span>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
        </label>
      </div>
      <div className="mt-4 rounded-xl p-4 bg-(--bg-card)">
        <label className="flex items-center gap-3">
          <span className="text-(--color-text-primary)">Logout</span>
          <button
          type="button"
          onClick={signOut}
          disabled={isLoading}
          className="btn btn-primary btn-sm"
        >
          {isLoading ? 'Signing out...' : 'Sign out'}
        </button>
        </label>
      </div>
    </div>
  )
}
