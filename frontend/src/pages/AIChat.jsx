import React, { useState, useRef, useEffect } from 'react'
import { PaperPlaneRight, SparkleIcon, User } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import apiClient from '../services/api'

export default function AIChat({ isPanel, aiPrompt }) {
  const systemPrompt = 'You are a friendly Japanese language tutor. Keep responses concise, helpful, and encouraging. When useful, include Japanese text with romanization and a short English explanation.'
  const quickPrompts = [
    'Help me practice a self-introduction in Japanese.',
    'Explain the difference between は and が.',
    'Give me 5 useful phrases for ordering food.',
  ]

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'こんにちは！ (Konnichiwa!)\n\nI am your AI Japanese tutor. How can I help you study today?'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const lastAutoPromptRef = useRef('')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const extractReplyText = (data) => {
    if (typeof data === 'string') {
      return data
    }

    return (
      data?.content ||
      data?.message?.content ||
      data?.message ||
      data?.reply ||
      data?.text ||
      'I could not generate a reply just now.'
    )
  }

  const updateMessageById = (messageId, updater) => {
    setMessages(prev => prev.map(message => (message.id === messageId ? updater(message) : message)))
  }

  const sendMessage = async (messageText) => {
    const trimmedInput = messageText.trim()
    if (!trimmedInput || isSending) return

    const newUserMsg = {
      id: Date.now(),
      role: 'user',
      content: trimmedInput
    }
    const thinkingMessageId = Date.now() + 1
    const thinkingMessage = {
      id: thinkingMessageId,
      role: 'assistant',
      content: 'Thinking...',
      status: 'thinking',
    }

    const conversation = [...messages, newUserMsg]

    setMessages(prev => [...prev, newUserMsg, thinkingMessage])
    setInputValue('')
    setIsSending(true)
    setError('')

    try {
      const response = await apiClient.post('/ai/chat', {
        messages: conversation.map(({ role, content }) => ({ role, content })),
        system_prompt: systemPrompt,
      })

      const replyContent = extractReplyText(response.data)
      updateMessageById(thinkingMessageId, () => ({
        id: Date.now(),
        role: 'assistant',
        content: replyContent,
      }))
    } catch (chatError) {
      setError(chatError.message || 'Failed to send message.')
      updateMessageById(thinkingMessageId, () => ({
        id: Date.now(),
        role: 'assistant',
        content: 'I could not reach the AI service right now. Please try again.',
      }))
    } finally {
      setIsSending(false)
    }
  }

  // Keep a stable handle on the latest sendMessage so the auto-prompt effect
  // only re-runs when aiPrompt itself changes.
  const sendMessageRef = useRef(sendMessage)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  })

  useEffect(() => {
    if (!aiPrompt || aiPrompt === lastAutoPromptRef.current) {
      return
    }

    lastAutoPromptRef.current = aiPrompt
    void sendMessageRef.current(aiPrompt)
  }, [aiPrompt])

  const handleSend = async (e) => {
    e.preventDefault()
    await sendMessage(inputValue)
  }

  return (
    <div className={`flex flex-col ${isPanel ? "h-full w-full bg-bg" : "h-[calc(100vh-160px)] max-w-4xl mx-auto"}`}>
      {!isPanel && (
        <div className="mb-4 shrink-0">
          <h1 className="font-display text-text-primary text-3xl font-bold mb-2">AI Tutor</h1>
          <p className="text-text-secondary text-sm">Chat with the AI to practice conversation and ask questions.</p>
        </div>
      )}

      {/* Chat Messages Area */}
      <div className={`grow overflow-y-auto ${isPanel ? "p-4" : "rounded-xl bg-bg-card p-4"} flex flex-col gap-4`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-primary text-white'}`}>
              {msg.role === 'user' ? <User size={18} weight="fill" /> : <SparkleIcon size={18} weight="fill" />}
            </div>
            <div className={`p-3 text-sm flex flex-col rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-sm whitespace-pre-wrap' : 'bg-bg-card border border-gray-200 dark:border-gray-700 text-text-primary rounded-tl-none shadow-sm whitespace-normal'}`}>
              {msg.status === 'thinking' ? (
                <div className="flex items-center gap-1.5 py-1 text-text-secondary">
                  <span className="text-sm font-medium">Thinking</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                  </span>
                </div>
              ) : msg.role === 'user' ? (
                msg.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-6">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="leading-6">{children}</li>,
                    code: ({ inline, children }) => (
                      inline ? (
                        <code className="rounded bg-black/5 px-1 py-0.5 text-[0.9em] text-primary dark:bg-white/10">{children}</code>
                      ) : (
                        <code className="block overflow-x-auto rounded-xl bg-black/5 p-3 font-mono text-xs leading-6 text-text-primary dark:bg-white/10">{children}</code>
                      )
                    ),
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong className="font-semibold text-text-primary dark:text-white">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`shrink-0 ${isPanel ? "p-4 border-t border-gray-200 dark:border-gray-700 bg-bg" : "mt-4"}`}>
        {!isPanel && messages.length === 1 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={isSending}
                className="rounded-full border border-gray-200 bg-bg-card px-3 py-2 text-left text-xs text-text-primary shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-bg-card"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <input
            type="text"
            className="w-full pr-12 focus:outline-primary rounded-full px-4 py-3 text-sm bg-bg-card border border-gray-200 dark:border-gray-700 text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isSending}
          />
          <button 
            type="submit" 
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle btn-primary shadow-sm"
            disabled={!inputValue.trim() || isSending}
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </form>
      </div>
    </div>
  )
}
