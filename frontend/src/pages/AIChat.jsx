import React from 'react'

export default function AIChat({ isPanel }) {
  return (
    <div className={isPanel ? "w-full" : "max-w-4xl mx-auto"}>
      {!isPanel && <h1 className="font-display text-text-primary font-bold text-3xl mb-4">AI Tutor</h1>}
      <p className="text-text-secondary text-sm">Chat with the AI to practice conversation and ask questions.</p>

      <div className="mt-4 rounded-xl p-4 bg-bg-card">
        <p className="text-text-secondary">This is a placeholder for the AI chat UI.</p>
      </div>
    </div>
  )
}
