import React, { useState, useRef, useEffect } from 'react'
import { PaperPlaneRight, SparkleIcon, User } from '@phosphor-icons/react'

export default function AIChat({ isPanel }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'こんにちは！ (Konnichiwa!)\n\nI am your AI Japanese tutor. How can I help you study today?'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const newUserMsg = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    }
    setMessages(prev => [...prev, newUserMsg])
    setInputValue('')

    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: 'That sounds great! Keep practicing.'
      }])
    }, 1000)
  }

  return (
    <div className={`flex flex-col ${isPanel ? "h-full w-full bg-bg" : "h-[calc(100vh-160px)] max-w-4xl mx-auto"}`}>
      {!isPanel && (
        <div className="mb-4 flex-shrink-0">
          <h1 className="font-display text-text-primary text-3xl font-bold mb-2">AI Tutor</h1>
          <p className="text-text-secondary text-sm">Chat with the AI to practice conversation and ask questions.</p>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className={`flex-grow overflow-y-auto ${isPanel ? "p-4" : "rounded-xl bg-bg-card p-4"} flex flex-col gap-4`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-primary text-white'}`}>
              {msg.role === 'user' ? <User size={18} weight="fill" /> : <SparkleIcon size={18} weight="fill" />}
            </div>
            <div className={`p-3 text-sm flex flex-col whitespace-pre-wrap rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-sm' : 'bg-bg-card border border-gray-200 dark:border-gray-700 text-text-primary rounded-tl-none shadow-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`flex-shrink-0 ${isPanel ? "p-4 border-t border-gray-200 dark:border-gray-700 bg-bg" : "mt-4"}`}>
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input
            type="text"
            className="w-full pr-12 focus:outline-primary rounded-full px-4 py-3 text-sm bg-bg-card border border-gray-200 dark:border-gray-700 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button 
            type="submit" 
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle btn-primary shadow-sm"
            disabled={!inputValue.trim()}
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </form>
      </div>
    </div>
  )
}
