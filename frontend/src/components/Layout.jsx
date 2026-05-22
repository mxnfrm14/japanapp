import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChatCircleDots, X } from '@phosphor-icons/react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import TopNavBar from './TopNavBar'
import AIChat from '../pages/AIChat'

export default function Layout({ children }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const location = useLocation()
  const isHomePage = location.pathname === '/'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const showChatLayout = !isMobile && !isHomePage

  return (
    <div className={`size-full transition-all duration-300 ease-in-out md:pl-[104px] ${isSidebarExpanded ? 'lg:pl-[280px]' : 'lg:pl-[104px]'}`}>
      <TopNavBar isExpanded={isSidebarExpanded} />

      <Sidebar isExpanded={isSidebarExpanded} toggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)} />

      {/* Main content stays clear of fixed top bar and desktop sidebar */}
      <main className={`pt-[56px] md:pt-[80px] lg:pt-[80px] p-4 md:p-8 lg:p-[48px] pb-20 md:pb-8 lg:pb-[48px] min-h-screen ${showChatLayout ? 'flex gap-6' : ''}`}>
        
        {/* Actual Content Area */}
        <div className={`transition-all duration-300 ${showChatLayout && isChatOpen ? 'w-3/4' : 'w-full'}`}>
          {children}
        </div>

        {/* AI Chat Panel */}
        {showChatLayout && (
          <div className={`transition-all duration-300 flex-shrink-0 relative ${isChatOpen ? 'w-1/4 opacity-100 block' : 'w-0 opacity-0 hidden'}`}>
            <div className="sticky top-[100px] h-[calc(100vh-140px)] flex flex-col bg-base-200 rounded-2xl overflow-hidden border border-base-content/10 dark:border-base-stroke-dark shadow-sm">
               <div className="flex justify-between items-center p-4 border-b border-base-content/10 bg-base-300">
                  <div className="flex items-center gap-2">
                     <ChatCircleDots size={24} weight="fill" className="text-primary" />
                     <h2 className="text-lg font-bold">AI Tutor</h2>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="btn btn-sm btn-ghost btn-circle">
                     <X size={20} />
                  </button>
               </div>
               <div className="p-4 flex-grow overflow-y-auto w-full">
                  <AIChat isPanel={true} />
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating button to open chat */}
      {showChatLayout && !isChatOpen && (
         <button 
           onClick={() => setIsChatOpen(true)}
           className="fixed right-8 bottom-8 btn btn-primary btn-circle btn-lg text-white shadow-lg z-50 transition-transform hover:scale-110">
           <ChatCircleDots size={32} weight="fill" />
         </button>
      )}

      {/* Bottom Navigation - Mobile only */}
      {isMobile && <BottomNav />}
    </div>
  )
}
