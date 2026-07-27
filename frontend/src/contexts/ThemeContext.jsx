import React, { useEffect, useState } from 'react'
import { ThemeContext } from './theme-context'

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const theme = localStorage.getItem('theme')
      if (theme === 'dark') return true
      if (theme === 'light') return false
    } catch (e) {
      console.error('Failed to read theme from localStorage:', e)
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')

    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e)
    }
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, setDark }}>
      {children}
    </ThemeContext.Provider>
  )
}
