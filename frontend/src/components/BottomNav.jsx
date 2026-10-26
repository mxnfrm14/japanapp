import { NavLink } from 'react-router-dom'
import { BookOpenIcon, HouseIcon, NotebookIcon, SparkleIcon, UserIcon } from '@phosphor-icons/react'

const destinations = [
  { to: '/', label: 'Home', icon: HouseIcon },
  { to: '/diary', label: 'Diary', icon: NotebookIcon },
  { to: '/ai', label: 'AI Tutor', icon: SparkleIcon },
  { to: '/vocabulary', label: 'Vocabulary', icon: BookOpenIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-[calc(12px+env(safe-area-inset-bottom,0px))] left-1/2 z-40 grid h-14 w-[calc(100%-24px)] max-w-[448px] -translate-x-1/2 grid-cols-5 items-center gap-1 rounded-2xl border border-border/30 bg-surface/95 px-1 shadow-[var(--shadow-md)] backdrop-blur-md md:hidden"
    >
      {destinations.map((destination) => {
        const { to, label, icon: Icon } = destination
        const isTutor = to === '/ai'

        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) => `flex min-w-11 items-center justify-center justify-self-center rounded-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
              isTutor
                ? `size-14 -translate-y-3 rounded-2xl bg-linear-to-r from-primary to-primary-hover text-text-inverse shadow-[var(--shadow-primary)] hover:from-primary-hover hover:to-primary-pressed dark:text-text-primary ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`
                : `h-11 w-full max-w-16 ${isActive ? 'bg-primary-subtle text-primary' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'}`
            }`}
          >
            {({ isActive }) => (
              <>
                <Icon size={isTutor ? 28 : 22} weight={isActive ? 'fill' : 'bold'} aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
