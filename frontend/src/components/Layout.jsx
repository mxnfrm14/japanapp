import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SparkleIcon, X } from '@phosphor-icons/react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import TopNavBar from './TopNavBar'
import AIChat from '../pages/AIChat'

export default function Layout({ children }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectionPrompt, setSelectionPrompt] = useState('')
  const [selectionTooltip, setSelectionTooltip] = useState(null)

  const location = useLocation()
  const isHomePage = location.pathname === '/'
  const isAIChatPage = location.pathname === '/ai'
  const isSettingsPage = location.pathname === '/settings'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const getSelectionState = () => {
      if (typeof window === 'undefined') return

      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setSelectionTooltip(null)
        return
      }

      const text = selection.toString().trim()
      if (!text) {
        setSelectionTooltip(null)
        return
      }

      const anchorElement = selection.anchorNode?.parentElement || selection.anchorNode?.parentNode
      if (anchorElement?.closest?.('input, textarea, select, [contenteditable="true"]')) {
        setSelectionTooltip(null)
        return
      }

      if (!selection.rangeCount) {
        setSelectionTooltip(null)
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (!rect || (!rect.width && !rect.height)) {
        setSelectionTooltip(null)
        return
      }

      const x = Math.max(24, Math.min(window.innerWidth - 24, rect.left + rect.width / 2))
      const showBelow = rect.top < 88
      const y = showBelow ? rect.bottom + 12 : Math.max(16, rect.top - 12)

      setSelectionTooltip({
        text,
        x,
        y,
        placement: showBelow ? 'below' : 'above',
      })
    }

    const handleSelectionChange = () => {
      window.requestAnimationFrame(getSelectionState)
    }

    const clearSelectionTooltip = (event) => {
      const target = event.target
      if (target?.closest?.('[data-selection-tooltip]')) {
        return
      }
      setSelectionTooltip(null)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)
    document.addEventListener('mousedown', clearSelectionTooltip)
    window.addEventListener('scroll', clearSelectionTooltip, true)
    window.addEventListener('resize', clearSelectionTooltip)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('mousedown', clearSelectionTooltip)
      window.removeEventListener('scroll', clearSelectionTooltip, true)
      window.removeEventListener('resize', clearSelectionTooltip)
    }
  }, [])

  const buildSelectionPrompt = (selectedText) => {
    return `Please explain this text in detail. Break down the meaning, grammar, and any useful context:\n\n${selectedText}`
  }

  const handleSelectionAsk = () => {
    if (!selectionTooltip?.text) return

    const prompt = buildSelectionPrompt(selectionTooltip.text)
    setSelectionPrompt(prompt)
    setSelectionTooltip(null)

    if (showChatLayout && !isChatOpen) {
      setIsChatOpen(true)
    }
  }

  const showChatLayout = !isMobile && !isHomePage && !isSettingsPage && !isAIChatPage
  const renderedChildren = React.isValidElement(children)
    ? React.cloneElement(children, { aiPrompt: selectionPrompt })
    : children

  return (
    <div className={`size-full transition-all duration-300 ease-in-out md:pl-26 ${isSidebarExpanded ? 'lg:pl-70' : 'lg:pl-26'}`}>
      <TopNavBar isExpanded={isSidebarExpanded} />

      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)} />

      {/* Main content stays clear of fixed top bar and desktop sidebar */}
      <main className={`pt-14 md:pt-20 lg:pt-20 p-4 md:p-8 pb-20 md:pb-8 min-h-screen ${showChatLayout ? 'flex gap-6' : ''}`}>
        
        {/* Actual Content Area */}
        <div className={`transition-all duration-300 ${showChatLayout && isChatOpen ? 'w-3/4' : 'w-full'}`}>
          {renderedChildren}
        </div>

        {/* AI Chat Panel */}
        {showChatLayout && (
          <div className={`transition-all duration-300 shrink-0 relative ${isChatOpen ? 'w-3/8 opacity-100 block' : 'w-0 opacity-0 hidden'}`}>
            <div className="sticky top-25 h-[calc(100vh-140px)] flex flex-col bg-bg rounded-2xl overflow-hidden border border-gray-300 dark:border-gray-600 shadow-sm">
               <div className="flex justify-between items-center p-4 border-b border-gray-300 dark:border-gray-600 bg-bg">
                  <div className="flex items-center gap-2">
                     <SparkleIcon size={24} weight="fill" className="text-primary" />
                     <h2 className="text-lg font-bold">AI Tutor</h2>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="btn btn-ghost btn-circle hover:bg-primary hover:text-white">
                     <X size={20} />
                  </button>
               </div>
               <div className="grow overflow-hidden flex flex-col w-full">
                  <AIChat isPanel={true} aiPrompt={selectionPrompt} />
               </div>
            </div>
          </div>
        )}
      </main>

      {selectionTooltip ? (
        <div
          data-selection-tooltip
          className="fixed z-60 -translate-x-1/2"
          style={{
            left: `${selectionTooltip.x}px`,
            top: `${selectionTooltip.y}px`,
            transform: selectionTooltip.placement === 'below'
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleSelectionAsk}
            className="max-w-[320px] rounded-full border border-primary/20 bg-bg-card px-4 py-2 text-sm font-medium text-primary shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-primary hover:text-white"
          >
            Ask AI about selection
          </button>
        </div>
      ) : null}

      {/* Floating button to open chat */}
      {showChatLayout && !isChatOpen && (
         <button 
           onClick={() => setIsChatOpen(true)}
           className="fixed right-8 bottom-8 btn btn-primary btn-circle btn-lg text-white shadow-lg z-50 transition-transform hover:scale-110">
           <SparkleIcon size={32} weight="fill" />
         </button>
      )}

      {/* Bottom Navigation - Mobile only */}
      {isMobile && <BottomNav />}
    </div>
  )
}
