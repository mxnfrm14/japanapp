import React from 'react'

export default function Kanji() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-(--color-text-primary)">Kanji</h1>
      <p className="text-(--color-text-secondary)">Study characters, readings and meanings.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {['日','月','火','水','木','金'].map((k) => (
          <div key={k} className="rounded-2xl p-6 text-center bg-(--bg-card)">
            <div className="text-[2.5rem] font-cjk text-(--color-text-primary)">{k}</div>
            <div className="mt-2 text-(--color-text-secondary)">meaning</div>
          </div>
        ))}
      </div>
    </div>
  )
}
