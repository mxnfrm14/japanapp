import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRightIcon,
  BookmarkSimpleIcon,
  BookOpenIcon,
  NotebookIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import DailyWordCard from '../components/DailyWordCard'
import SearchField from '../components/SearchField'
import { getEntry, toDateKey } from '../services/diaryStorage'
import { useAuthStore } from '../stores/authStore'
import './Home.css'

const resources = [
  { to: '/kana', japanese: 'あ', title: 'Kana', description: 'Get to know hiragana and katakana.' },
  { to: '/kanji', japanese: '字', title: 'Kanji', description: 'Discover the characters behind the words.' },
  { to: '/vocabulary', icon: BookOpenIcon, title: 'Vocabulary', description: 'Find the words you want to use.' },
]

// Keep both daily cards on the local calendar day, including after a sleeping tab returns.
function useToday() {
  const [dateKey, setDateKey] = useState(() => toDateKey())

  useEffect(() => {
    let timer
    const update = () => {
      setDateKey(toDateKey())
      window.clearTimeout(timer)
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      timer = window.setTimeout(update, midnight.getTime() - Date.now() + 100)
    }
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return dateKey
}

export default function Home() {
  const user = useAuthStore((state) => state.user)
  const dateKey = useToday()
  const name = (user?.display_name || user?.user_metadata?.display_name || '').trim()
  const diary = useQuery({
    queryKey: ['diary', user?.id, 'entry', dateKey],
    queryFn: () => getEntry(dateKey),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  })
  const diaryAction = diary.isPending || diary.isFetching || diary.isError
    ? 'Open your diary'
    : diary.data?.text?.trim()
      ? 'Continue today’s entry'
      : 'Start today’s entry'

  return (
    <div className="home-page">
      <header className="home-header">
        <p className="home-eyebrow"><span lang="ja" className="font-cjk">毎日、少しずつ。</span><span className="home-eyebrow-line" />YOUR DAILY PRACTICE</p>
        <h1>{name ? `Welcome back, ${name}.` : 'A little Japanese, every day.'}</h1>
        <p className="home-intro">One word to discover. A little time to make it yours.</p>
      </header>

      <SearchField className="home-search md:hidden" />

      <div className="home-daily-grid">
        <DailyWordCard key={`${user?.id}:${dateKey}`} />

        <div className="home-practice">
          <section className="home-panel home-practice-card" aria-labelledby="home-diary-title">
            <div className="home-card-label"><NotebookIcon size={20} aria-hidden="true" /><span>YOUR DAILY JOURNAL</span><span lang="ja" className="font-cjk">日記</span></div>
            <h2 id="home-diary-title">A few lines.<br />A little progress.</h2>
            <p>Write a few lines about your day. Let your Japanese grow in your own words.</p>
            <Link to="/diary" className="home-text-link">{diaryAction}<ArrowRightIcon size={18} aria-hidden="true" /></Link>
          </section>

          <section className="home-panel home-practice-card home-tutor-card" aria-labelledby="home-tutor-title">
            <div className="home-card-label"><SparkleIcon size={20} aria-hidden="true" /><span>A LITTLE CONVERSATION</span><span lang="ja" className="font-cjk">会話</span></div>
            <h2 id="home-tutor-title">Put your Japanese<br />into words.</h2>
            <p>Practice with your AI tutor. Ask a question, try a phrase, or just say こんにちは.</p>
            <Link to="/ai" className="home-text-link">Talk to your tutor<ArrowRightIcon size={18} aria-hidden="true" /></Link>
          </section>
        </div>
      </div>

      <section className="home-explore" aria-labelledby="home-explore-title">
        <div className="home-section-heading">
          <div>
            <h2 id="home-explore-title">Explore Japanese</h2>
            <p>Follow your curiosity, one discovery at a time.</p>
          </div>
          <Link to="/profile" className="home-saved-link"><BookmarkSimpleIcon size={18} aria-hidden="true" />Your saved words<ArrowRightIcon size={16} aria-hidden="true" /></Link>
        </div>
        <div className="home-resources">
          {resources.map(({ to, japanese, icon: Icon, title, description }) => (
            <Link to={to} key={to} className="home-panel home-resource">
              <span className="home-resource-symbol" aria-hidden="true">
                {Icon ? <Icon size={26} /> : <span lang="ja" className="font-cjk">{japanese}</span>}
              </span>
              <div><h3>{title}</h3><p>{description}</p></div>
              <ArrowRightIcon size={20} className="home-resource-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
