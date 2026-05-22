/** @type {import('tailwindcss').Config} */
// Tailwind v4: theme tokens live in @theme inside index.css.
// This file only needs content paths and the dark mode strategy.
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class', // toggled by ThemeContext adding .dark on <html>
}