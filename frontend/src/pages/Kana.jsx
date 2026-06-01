import React, { useEffect, useMemo, useState } from 'react'
import apiClient from '../services/api'

const tabOptions = [
  { key: 'hiragana', label: 'Hiragana' ,jplabel: 'ひらがな' },
  { key: 'katakana', label: 'Katakana' ,jplabel: 'カタカナ' },
]

const majorDesktopLayouts = {
  hiragana: [
    ['ん', 'わ', 'ら', 'や', 'ま', 'は', 'な', 'た', 'さ', 'か', 'あ'],
    ['', '', 'り', '', 'み', 'ひ', 'に', 'ち', 'し', 'き', 'い'],
    ['', '', 'る', 'ゆ', 'む', 'ふ', 'ぬ', 'つ', 'す', 'く', 'う'],
    ['', '', 'れ', '', 'め', 'へ', 'ね', 'て', 'せ', 'け', 'え'],
    ['', 'を', 'ろ', 'よ', 'も', 'ほ', 'の', 'と', 'そ', 'こ', 'お'],
  ],
  katakana: [
    ['ン', 'ワ', 'ラ', 'ヤ', 'マ', 'ハ', 'ナ', 'タ', 'サ', 'カ', 'ア'],
    ['', '', 'リ', '', 'ミ', 'ヒ', 'ニ', 'チ', 'シ', 'キ', 'イ'],
    ['', '', 'ル', 'ユ', 'ム', 'フ', 'ヌ', 'ツ', 'ス', 'ク', 'ウ'],
    ['', '', 'レ', '', 'メ', 'ヘ', 'ネ', 'テ', 'セ', 'ケ', 'エ'],
    ['', 'ヲ', 'ロ', 'ヨ', 'モ', 'ホ', 'ノ', 'ト', 'ソ', 'コ', 'オ'],
  ],
}

const majorStackedLayouts = {
  hiragana: [
    ['あ', 'い', 'う', 'え', 'お'],
    ['か', 'き', 'く', 'け', 'こ'],
    ['さ', 'し', 'す', 'せ', 'そ'],
    ['た', 'ち', 'つ', 'て', 'と'],
    ['な', 'に', 'ぬ', 'ね', 'の'],
    ['は', 'ひ', 'ふ', 'へ', 'ほ'],
    ['ま', 'み', 'む', 'め', 'も'],
    ['や', '', 'ゆ', '', 'よ'],
    ['ら', 'り', 'る', 'れ', 'ろ'],
    ['わ', '', '', '', 'を'],
    ['ん', '', '', '', ''],
  ],
  katakana: [
    ['ア', 'イ', 'ウ', 'エ', 'オ'],
    ['カ', 'キ', 'ク', 'ケ', 'コ'],
    ['サ', 'シ', 'ス', 'セ', 'ソ'],
    ['タ', 'チ', 'ツ', 'テ', 'ト'],
    ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
    ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
    ['マ', 'ミ', 'ム', 'メ', 'モ'],
    ['ヤ', '', 'ユ', '', 'ヨ'],
    ['ラ', 'リ', 'ル', 'レ', 'ロ'],
    ['ワ', '', '', '', 'ヲ'],
    ['ン', '', '', '', ''],
  ],
}

const dakutenGroups = ['g', 'z', 'd', 'b']
const handakutenGroups = ['p']

const youonLayouts = {
  hiragana: [
    ['きゃ', 'きゅ', 'きょ'],
    ['しゃ', 'しゅ', 'しょ'],
    ['ちゃ', 'ちゅ', 'ちょ'],
    ['にゃ', 'にゅ', 'にょ'],
    ['ひゃ', 'ひゅ', 'ひょ'],
    ['みゃ', 'みゅ', 'みょ'],
    ['りゃ', 'りゅ', 'りょ'],
    ['ぎゃ', 'ぎゅ', 'ぎょ'],
    ['じゃ', 'じゅ', 'じょ'],
    ['びゃ', 'びゅ', 'びょ'],
    ['ぴゃ', 'ぴゅ', 'ぴょ'],
  ],
  katakana: [
    ['キャ', 'キュ', 'キョ'],
    ['シャ', 'シュ', 'ショ'],
    ['チャ', 'チュ', 'チョ'],
    ['ニャ', 'ニュ', 'ニョ'],
    ['ヒャ', 'ヒュ', 'ヒョ'],
    ['ミャ', 'ミュ', 'ミョ'],
    ['リャ', 'リュ', 'リョ'],
    ['ギャ', 'ギュ', 'ギョ'],
    ['ジャ', 'ジュ', 'ジョ'],
    ['ビャ', 'ビュ', 'ビョ'],
    ['ピャ', 'ピュ', 'ピョ'],
  ],
}

function groupRows(rows) {
  return rows.reduce((accumulator, row) => {
    const groupName = row.group_name || 'other'

    if (!accumulator[groupName]) {
      accumulator[groupName] = []
    }

    accumulator[groupName].push(row)
    return accumulator
  }, {})
}

function KanaCard({ kana, empty = false }) {
  if (empty || !kana) {
    return <div className="min-h-24 rounded-2xl border border-dashed border-transparent bg-transparent" aria-hidden="true" />
  }

  return (
    <div className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-surface p-3 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-surface-raised dark:border-gray-700">
      <div className="font-cjk text-3xl leading-none text-text-primary md:text-4xl">{kana.character}</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-[0.24em] text-text-muted">{kana.romaji}</div>
    </div>
  )
}

function KanaMatrix({ rows, lookup, largeLayout = false }) {
  return (
    <div className={largeLayout ? 'hidden lg:block' : 'lg:hidden'}>
      <div className="grid gap-3">
        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={`grid gap-3 ${largeLayout ? 'grid-cols-11' : 'grid-cols-5'}`}>
            {row.map((character, columnIndex) => {
              if (!character) {
                return <KanaCard key={`empty-${rowIndex}-${columnIndex}`} empty />
              }

              const kana = lookup.get(character)

              return <KanaCard key={character} kana={kana} empty={!kana} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function KanaSection({ title, description, rows, columns = 5 }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
      <div className="mb-4">
        <h2 className="font-display text-xl text-text-primary md:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>

      <div className="grid gap-3">
        {rows.map((row, rowIndex) => (
          <div key={`${title}-row-${rowIndex}`} className={`grid gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-5'}`}>
            {row.map((kana, columnIndex) => (
              <KanaCard key={kana?.id || `${title}-empty-${rowIndex}-${columnIndex}`} kana={kana} empty={!kana} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Kana() {
  const [activeTab, setActiveTab] = useState('hiragana')
  const [kanaRows, setKanaRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadKana = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await apiClient.get(`/kana/${activeTab}`)

        if (!isActive) {
          return
        }

        setKanaRows(Array.isArray(response.data) ? response.data : [])
      } catch (requestError) {
        if (!isActive) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Failed to load kana')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadKana()

    return () => {
      isActive = false
    }
  }, [activeTab])

  const visibleRows = useMemo(
    () => kanaRows.filter((row) => row.group_name !== 'special'),
    [kanaRows],
  )

  const lookup = useMemo(() => new Map(visibleRows.map((row) => [row.character, row])), [visibleRows])
  const groupedRows = useMemo(() => groupRows(visibleRows), [visibleRows])

  const majorDesktopRows = majorDesktopLayouts[activeTab]
  const majorStackedRows = majorStackedLayouts[activeTab]
  const youonRows = youonLayouts[activeTab].map((row) => row.map((character) => lookup.get(character) || null))
  const dakutenRows = dakutenGroups.flatMap((groupName) => groupedRows[groupName] || [])
  const handakutenRows = handakutenGroups.flatMap((groupName) => groupedRows[groupName] || [])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl text-text-primary md:text-4xl">Kana 仮名</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary md:text-base">
            Browse kana charts in reading order, with separate tables for youon and the voiced and semi-voiced groups.
          </p>
        </div>

        <div className="inline-flex w-full rounded-xl bg-bg-card p-1 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 sm:w-fit">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-primary text-text-inverse shadow-sm' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                aria-pressed={isActive}
              >
                {tab.label} ({tab.jplabel})
              </button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-gray-200 bg-bg-card p-8 text-center text-text-secondary shadow-sm dark:border-gray-700">
          Loading {activeTab}...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-text-primary md:text-2xl">{activeTab === 'hiragana' ? 'ひらがな' : 'カタカナ'}</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {activeTab === 'hiragana' ? 'ひらがな' : 'カタカナ'} in the classic Japanese reading order.
                </p>
              </div>
            </div>

            <KanaMatrix rows={majorDesktopRows} lookup={lookup} largeLayout />
            <KanaMatrix rows={majorStackedRows} lookup={lookup} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <KanaSection
              title="Youon"
              description="Small kana combinations such as きゃ, しゅ, and ちょ."
              rows={youonRows}
              columns={3}
            />

            <section className="rounded-3xl border border-gray-200 bg-bg-card p-5 shadow-sm dark:border-gray-700 md:p-6">
              <div className="mb-5">
                <h2 className="font-display text-xl text-text-primary md:text-2xl">Dakuten & Handakuten</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  The voiced and semi-voiced kana groups: G, Z, D, B, and P.
                </p>
              </div>

              <div className="space-y-5">
                {dakutenRows.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                        Dakuten
                      </span>
                      <span className="text-sm text-text-secondary">G, Z, D, B</span>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {dakutenRows.map((kana) => (
                        <KanaCard key={kana.id} kana={kana} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {handakutenRows.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                        Handakuten
                      </span>
                      <span className="text-sm text-text-secondary">P</span>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {handakutenRows.map((kana) => (
                        <KanaCard key={kana.id} kana={kana} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
