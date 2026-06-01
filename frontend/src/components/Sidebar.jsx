import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from "../contexts/ThemeContext";
import { HouseIcon, CardsIcon, BookBookmarkIcon , ChatIcon, GearIcon, SparkleIcon, UserIcon, SunIcon, MoonIcon} from '@phosphor-icons/react'

const links = [
  { to: '/', label: 'Home', icon: <HouseIcon size={20} weight="bold"/> , jptext: "ホーム"},
  { to: '/flashcards', label: 'Flashcards', icon: <CardsIcon size={20} weight="bold"/> , jptext: "フラッシュカード"},
  { to: '/vocabulary', label: 'Vocabulary', icon: <BookBookmarkIcon size={20} weight="bold"/> , jptext: "単語"},
  { to: '/kana', label: 'Kana', icon: "あ", jptext: "仮名"},
  { to: '/kanji', label: 'Kanji', icon: "学", jptext: "漢字"},

]

export default function Sidebar({ isExpanded = true, toggleSidebar = () => {} }) {
   const { dark, setDark } = useTheme();
  return (
    <nav
      className={`hidden md:flex fixed left-3 top-3 bottom-3 flex-col gap-6 z-40 bg-secondary rounded-lg shadow-md transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-[80px] lg:w-[256px] p-4 lg:p-[20px]' : 'w-[80px] p-4'
      }`}
    >
      <div 
        className="flex flex-col items-center w-full pt-3 pb-4 cursor-pointer hover:opacity-80 transition-opacity select-none"
        onClick={toggleSidebar}
        title="Toggle Sidebar"
      >
        <p className="text-center font-display text-2xl font-bold text-primary whitespace-nowrap overflow-hidden">
          {isExpanded ? (
            <>
              <span className="lg:hidden">幸</span>
              <span className="hidden lg:inline">幸 日本語</span>
            </>
          ) : (
            <span>幸</span>
          )}
        </p>
      </div>

      <div className="flex flex-col justify-between flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) => `flex items-center gap-3 rounded-lg py-2 px-3 transition-all ${isExpanded ? 'justify-center lg:justify-start' : 'justify-center'} ${isActive ? 'shadow-sm bg-surface text-primary font-semibold' : 'bg-transparent text-text-primary hover:bg-(--color-hover)'}`}
            >
              <span className="flex items-center justify-center w-5 h-5 shrink-0 text-[1.1rem]">
                {l.icon}
              </span>
              <span className={`truncate ${isExpanded ? 'hidden lg:block' : 'hidden'}`}>{l.jptext}</span>
              <span className={`text-xs text-text-muted ml-auto ${isExpanded ? 'hidden lg:block' : 'hidden'}`}>{l.label}</span>
            </NavLink>
          ))}

          {/* AI Chat - emphasized */}
          <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
            <NavLink
              to="/ai"
              className={({ isActive }) => `relative flex items-center gap-3 rounded-lg py-2 px-3 transition-all ${isExpanded ? 'justify-center lg:justify-start' : 'justify-center'} ${isActive ? 'shadow-lg bg-primary text-text-inverse' : 'bg-primary-subtle text-primary hover:bg-primary-hover'}`}
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center justify-center w-5 h-5 shrink-0">
                    <SparkleIcon size={20} weight={isActive ? "fill" : "bold"} />
                  </span>
                  <div className={`gap-[8px] items-center leading-[0] flex-1 min-w-0 ${isExpanded ? 'hidden lg:flex' : 'hidden'}`}>
                    <div className="font-semibold text-[14px]">AI Chat</div>
                  </div>
                </>
              )}
            </NavLink>
          </div>
      </div>
        {/* Settings at bottom */}
        <div className="pt-3 border-t border-gray-300 dark:border-gray-600 flex flex-col gap-2">
          <button
            onClick={() => setDark(!dark)}
            className={`flex items-center gap-3 rounded-lg py-2 px-3 transition-all ${isExpanded ? 'justify-center lg:justify-start' : 'justify-center'} bg-transparent text-text-primary hover:bg-(--color-hover) w-full`}
          >
            <span className="flex items-center justify-center w-5 h-5 shrink-0">
              {dark ? <SunIcon size={20} weight="bold" /> : <MoonIcon size={20} weight="bold" />}
            </span>
            <span className={`truncate ${isExpanded ? 'hidden lg:block' : 'hidden'}`}>
              {dark ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `flex items-center gap-3 rounded-lg py-2 px-3 transition-all ${isExpanded ? 'justify-center lg:justify-start' : 'justify-center'} ${isActive ? 'shadow-sm bg-surface text-primary font-semibold' : 'bg-transparent text-text-primary hover:bg-(--color-hover)'}`}
          >
            <span className="flex items-center justify-center w-5 h-5 shrink-0">
              <GearIcon size={20} weight="bold"/>
            </span>
            <span className={`truncate ${isExpanded ? 'hidden lg:block' : 'hidden'}`}>Settings</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `flex items-center gap-3 rounded-lg py-2 px-3 transition-all ${isExpanded ? 'justify-center lg:justify-start' : 'justify-center'} ${isActive ? 'shadow-sm bg-surface text-primary font-semibold' : 'bg-transparent text-text-primary hover:bg-(--bg-hover)'}`}
          >
            <span className="flex items-center justify-center w-5 h-5 shrink-0">
              <UserIcon size={20} weight="bold"/>
            </span>
            <span className={`truncate ${isExpanded ? 'hidden lg:block' : 'hidden'}`}>Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
