import { useEffect } from 'react'
import { matchPath, useLocation } from 'react-router-dom'

const pageTitles = [
  { path: '/login', title: 'Login' },
  { path: '/kana', title: 'Kana' },
  { path: '/kanji', title: 'Kanji' },
  { path: '/kanji/:kanjiId', title: 'Kanji' },
  { path: '/vocabulary', title: 'Vocabulary' },
  { path: '/vocabulary/:vocabularyId', title: 'Vocabulary' },
  { path: '/flashcards', title: 'Flashcards' },
  { path: '/diary', title: 'Diary' },
  { path: '/ai', title: 'AI Chat' },
  { path: '/settings', title: 'Settings' },
  { path: '/profile', title: 'Profile' },
]

export default function PageTitle() {
  const { pathname } = useLocation()
  const page = pageTitles.find(({ path }) => matchPath(path, pathname))
  const title = page ? `${page.title} | Sachi` : 'Sachi'

  useEffect(() => {
    document.title = title
  }, [title])

  return null
}
