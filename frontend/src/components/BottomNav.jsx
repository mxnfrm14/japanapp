import React from 'react'
import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="fixed bottom-4 left-1/2 flex w-[92%] max-w-3xl -translate-x-1/2 transform items-center justify-between rounded-2xl border border-[var(--border-color)] p-3 shadow-lg [background-color:color-mix(in_srgb,var(--bg-primary)_80%,transparent)] backdrop-blur-[8px] lg:hidden">
      <NavLink to="/" className={({ isActive }) => `flex-1 py-2 text-center text-(--color-text-secondary) ${isActive ? 'font-semibold' : ''}`}>
        <div>🏠</div>
        <div className="text-xs">Home</div>
      </NavLink>

      <NavLink to="/flashcards" className={({ isActive }) => `flex-1 py-2 text-center text-(--color-text-secondary) ${isActive ? 'font-semibold' : ''}`}>
        <div>🃏</div>
        <div className="text-xs">Flashcards</div>
      </NavLink>

      <NavLink to="/ai" className={({ isActive }) => `flex-none mx-2`}> 
        <div className="flex h-16 w-16 -translate-y-[14px] items-center justify-center rounded-[20px] bg-gradient-to-r from-(--accent-red) to-(--accent-red-light) text-white shadow-[var(--shadow-md)]">
          <div className="text-2xl">🤖</div>
        </div>
      </NavLink>

      <NavLink to="/kana" className={({ isActive }) => `flex-1 py-2 text-center text-(--color-text-secondary) ${isActive ? 'font-semibold' : ''}`}>
        <div>あ</div>
        <div className="text-xs">Alphabet</div>
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => `flex-1 py-2 text-center text-(--color-text-secondary) ${isActive ? 'font-semibold' : ''}`}>
        <div>👤</div>
        <div className="text-xs">User</div>
      </NavLink>
    </nav>
  )
}
