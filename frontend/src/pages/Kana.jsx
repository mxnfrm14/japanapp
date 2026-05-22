import React from 'react'

export default function Kana() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-(--color-text-primary)">Hiragana & Katakana</h1>
      <p className="text-(--color-text-secondary)">Browse kana charts and practice readings.</p>

      <div className="mt-6 grid grid-cols-4 gap-3">
        {['あ','い','う','え','お','か','き','く','け','こ'].map((k) => (
          <div key={k} className="rounded-xl p-4 text-center bg-(--bg-card)">
            <div className="text-[1.5rem] font-cjk text-(--color-text-primary)">{k}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
