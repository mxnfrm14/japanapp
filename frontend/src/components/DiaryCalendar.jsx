import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react'
import { formatDateKey, shiftDateKey, toDateKey } from '../services/diaryStorage.js'
import { entryTitle, hasEntryContent, monthDates, monthLabel, shiftMonth, startOfMonth, startOfWeek, weekDates } from '../utils/diaryCalendar.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function DayButton({ date, selectedDate, writtenDates, onSelect, disabled, outsideMonth = false, weekday }) {
  const today = toDateKey()
  const hasEntry = writtenDates.has(date)
  const isSelected = date === selectedDate
  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      disabled={disabled || date > today}
      aria-label={`${formatDateKey(date)}${hasEntry ? ', has an entry' : ''}${date === today ? ', today' : ''}`}
      aria-pressed={isSelected}
      aria-current={date === today ? 'date' : undefined}
      className={`diary-day ${isSelected ? 'is-selected' : ''} ${date === today ? 'is-today' : ''} ${outsideMonth ? 'is-outside' : ''}`}
    >
      {weekday ? <span className="diary-day-weekday">{weekday}</span> : null}
      <span className="diary-day-number">{Number(date.slice(-2))}</span>
      <span className={`diary-day-dot ${hasEntry ? 'has-entry' : ''}`} aria-hidden="true" />
    </button>
  )
}

export function DiaryWeekStrip({ dateKey, entries, onSelect, disabled }) {
  const [week, setWeek] = useState(() => startOfWeek(dateKey))
  const viewportRef = useRef(null)
  const timerRef = useRef(null)
  const todayWeek = startOfWeek(toDateKey())
  const writtenDates = new Set(entries.filter(hasEntryContent).map((entry) => entry.date))

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const center = () => viewport.scrollTo({ left: viewport.clientWidth, behavior: 'instant' })
    center()
    window.addEventListener('resize', center)
    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('resize', center)
    }
  }, [week])

  const moveWeek = (direction) => {
    const viewport = viewportRef.current
    viewport.scrollTo({ left: viewport.clientWidth * (direction + 1),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <section className="diary-week" aria-label="Choose a day">
      <div className="diary-week-heading">
        <span>{monthLabel(week)}</span>
        <div className="diary-inline-actions">
          <button type="button" className="diary-icon-button" onClick={() => moveWeek(-1)} disabled={disabled} aria-label="Previous week"><CaretLeftIcon size={17} /></button>
          <button type="button" className="diary-icon-button" onClick={() => moveWeek(1)} disabled={disabled || week >= todayWeek} aria-label="Next week"><CaretRightIcon size={17} /></button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="diary-week-viewport"
        onScroll={() => {
          clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            const viewport = viewportRef.current
            if (!viewport?.clientWidth) return
            const offset = Math.round(viewport.scrollLeft / viewport.clientWidth) - 1
            const next = shiftDateKey(week, offset * 7)
            if (offset && next <= todayWeek) setWeek(next)
            else if (next > todayWeek) viewport.scrollTo({ left: viewport.clientWidth, behavior: 'instant' })
          }, 120)
        }}
      >
        {[-1, 0, 1].map((offset) => (
          <div key={offset} className="diary-week-page" inert={offset !== 0} aria-hidden={offset !== 0}>
            {weekDates(shiftDateKey(week, offset * 7)).map((date, index) => (
              <DayButton key={date} date={date} selectedDate={dateKey} writtenDates={writtenDates} onSelect={onSelect} disabled={disabled} weekday={WEEKDAYS[index]} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function DiaryHistoryDialog({ entries, dateKey, onSelect, onClose, isBusy, error }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const [month, setMonth] = useState(() => startOfMonth(dateKey))
  const written = entries.filter(hasEntryContent)
  const writtenDates = new Set(written.map((entry) => entry.date))
  const groups = new Map()
  for (const entry of written) {
    const key = startOfMonth(entry.date)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const select = async (date) => {
    if (await onSelect(date)) onClose()
  }

  return (
    <dialog ref={dialogRef} className="diary-history" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="diary-history-inner">
        <header className="diary-history-heading">
          <div><span className="diary-eyebrow">YOUR JOURNAL</span><h2 id={titleId}>Every day, a little story.</h2></div>
          <button type="button" className="diary-icon-button" onClick={onClose} aria-label="Close history" autoFocus><XIcon size={20} /></button>
        </header>
        {error ? <p className="diary-error" role="alert">{error}</p> : null}
        <div className="diary-history-body">
          <section className="diary-month" aria-label="Calendar">
            <div className="diary-month-heading">
              <button type="button" className="diary-icon-button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><CaretLeftIcon size={18} /></button>
              <h3>{monthLabel(month)}</h3>
              <button type="button" className="diary-icon-button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= startOfMonth(toDateKey())} aria-label="Next month"><CaretRightIcon size={18} /></button>
            </div>
            <div className="diary-month-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div>
            <div className="diary-month-days">
              {monthDates(month).map((date) => (
                <DayButton key={date} date={date} selectedDate={dateKey} writtenDates={writtenDates} onSelect={select} disabled={isBusy} outsideMonth={date.slice(0, 7) !== month.slice(0, 7)} />
              ))}
            </div>
            <p className="diary-calendar-legend"><span className="diary-day-dot has-entry" aria-hidden="true" />A day with an entry</p>
          </section>
          <section className="diary-archive" aria-label="Journal entries">
            {written.length === 0 ? (
              <div className="diary-archive-empty"><CalendarBlankIcon size={28} /><h3>Your journal starts here.</h3><p>Give today a few words. Your entries will appear here as you write.</p></div>
            ) : [...groups].map(([key, rows]) => (
              <section key={key} className="diary-archive-group">
                <h3>{monthLabel(key)}</h3>
                {rows.map((entry) => (
                  <button key={entry.date} type="button" className={`diary-archive-entry ${entry.date === dateKey ? 'is-selected' : ''}`} onClick={() => select(entry.date)} disabled={isBusy}>
                    <span className="diary-archive-date">{formatDateKey(entry.date)}</span>
                    <span className="diary-archive-title">{entryTitle(entry)}</span>
                    {entry.text ? <span className="diary-archive-preview" lang="ja">{entry.text}</span> : null}
                    <span className="diary-archive-status">{entry.correction ? 'Checked' : 'Not checked yet'}</span>
                  </button>
                ))}
              </section>
            ))}
          </section>
        </div>
      </div>
    </dialog>
  )
}
