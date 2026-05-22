import React from 'react'

export default function Vocabulary() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-text-primary">Vocabulary</h1>
      <p className="text-text-secondary">Lists, examples, and spaced repetition.</p>

      <ul className="mt-6 space-y-3">
        <li className="rounded-xl p-3 card">
          <div className="text-text-primary">日本 (にほん) — Japan</div>
        </li>
        <li className="rounded-xl p-3 card">
          <div className="text-text-primary">学生 (がくせい) — Student</div>
        </li>
      </ul>
    </div>
  )
}
