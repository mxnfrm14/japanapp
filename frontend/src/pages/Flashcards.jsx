import React from 'react'

export default function Flashcards() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-text-primary">Flashcards</h1>
      <p className="text-text-secondary">Quick review to strengthen memory.</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-6 bg-(--bg-card)">
          <div className="text-5xl font-(--font-cjk)">日</div>
          <div className="text-text-secondary">にち / day</div>
        </div>
        <div className="rounded-xl p-6 bg-(--bg-card)">
          <div className="text-5xl font-(--font-cjk)">月</div>
          <div className="text-text-secondary">げつ / moon</div>
        </div>
      </div>
    </div>
  )
}
