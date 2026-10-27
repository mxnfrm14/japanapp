import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteEntry, getEntry, listEntries, saveEntry, toDateKey } from '../services/diaryStorage.js'
import { requestCorrection } from '../services/diaryCorrection.js'

const blankEntry = (date) => ({ date, title: '', text: '', correction: null })
const fingerprint = ({ date, title, text, correction }) => JSON.stringify({ date, title, text, correction })

export default function useDiary() {
  const [draft, setDraft] = useState(() => blankEntry(toDateKey()))
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const [error, setError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const draftRef = useRef(draft)
  const entriesRef = useRef(entries)
  const savedRef = useRef(new Map([[draft.date, fingerprint(draft)]]))
  const queueRef = useRef(Promise.resolve())
  const timerRef = useRef(null)
  const checkingRef = useRef(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(false)

  const updateEntries = useCallback((rows) => {
    entriesRef.current = rows
    if (mountedRef.current) setEntries(rows)
  }, [])

  const replaceEntry = useCallback((entry) => {
    updateEntries([...entriesRef.current.filter((row) => row.date !== entry.date), entry]
      .sort((a, b) => b.date.localeCompare(a.date)))
  }, [updateEntries])

  const updateDraft = useCallback((entry) => {
    draftRef.current = entry
    setDraft(entry)
  }, [])

  // Serialize writes so a slow earlier save cannot overwrite a newer draft.
  const persist = useCallback((snapshot) => {
    const key = fingerprint(snapshot)
    const task = queueRef.current.catch(() => null).then(async () => {
      if (savedRef.current.get(snapshot.date) === key) return
      const saved = await saveEntry(snapshot)
      savedRef.current.set(snapshot.date, key)
      replaceEntry(saved)
      if (mountedRef.current && fingerprint(draftRef.current) === key) {
        setSaveState('saved')
        setError('')
      }
    })
    queueRef.current = task
    return task
  }, [replaceEntry])

  const cancelCheck = useCallback(() => {
    checkingRef.current?.controller.abort()
    checkingRef.current = null
    setIsChecking(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      checkingRef.current?.controller.abort()
      checkingRef.current = null
      // Flush a pending debounce when leaving the page, too.
      if (!busyRef.current) void persist(draftRef.current).catch(() => null)
    }
  }, [persist])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    listEntries().then((rows) => {
      if (!active) return
      updateEntries(rows)
      const entry = rows.find((row) => row.date === draftRef.current.date) || blankEntry(draftRef.current.date)
      savedRef.current.set(entry.date, fingerprint(entry))
      updateDraft(entry)
      setSaveState(entry.id ? 'saved' : 'idle')
      setIsLoaded(true)
    }).catch(() => {
      if (active) setError('Could not load your journal. Please try again.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [loadVersion, updateDraft, updateEntries])

  useEffect(() => {
    if (!isLoaded || isBusy || savedRef.current.get(draft.date) === fingerprint(draft)) return
    timerRef.current = setTimeout(() => {
      void persist(draft).catch(() => {
        if (mountedRef.current) {
          setError('Your changes could not be saved. They are still here; please retry.')
          setSaveState('error')
        }
      })
    }, 1200)
    return () => clearTimeout(timerRef.current)
  }, [draft, isLoaded, isBusy, persist])

  const edit = (field, value) => {
    if (busyRef.current) return
    const next = { ...draftRef.current, [field]: value }
    updateDraft(next)
    setSaveState(savedRef.current.get(next.date) === fingerprint(next) ? (next.id ? 'saved' : 'idle') : 'saving')
  }

  const retrySave = async () => {
    if (busyRef.current) return
    clearTimeout(timerRef.current)
    setSaveState('saving')
    try {
      await persist(draftRef.current)
      setError('')
    } catch {
      setSaveState('error')
      setError('Your changes could not be saved. Please try again.')
    }
  }

  const selectDate = async (date) => {
    if (!isLoaded || busyRef.current || date > toDateKey()) return false
    if (date === draftRef.current.date) return true
    busyRef.current = true
    setIsBusy(true)
    clearTimeout(timerRef.current)
    cancelCheck()
    setError('')
    try {
      await persist(draftRef.current)
      const entry = await getEntry(date) || blankEntry(date)
      if (!mountedRef.current) return false
      if (entry.id) replaceEntry(entry)
      savedRef.current.set(date, fingerprint(entry))
      updateDraft(entry)
      setSaveState(entry.id ? 'saved' : 'idle')
      return true
    } catch {
      if (mountedRef.current) {
        setError('Could not change day. Your current entry has been kept; please try again.')
        if (savedRef.current.get(draftRef.current.date) !== fingerprint(draftRef.current)) setSaveState('error')
      }
      return false
    } finally {
      busyRef.current = false
      if (mountedRef.current) setIsBusy(false)
    }
  }

  const check = async () => {
    const source = draftRef.current
    if (checkingRef.current || busyRef.current || !source.text.trim()) return
    const job = { controller: new AbortController(), date: source.date }
    checkingRef.current = job
    setIsChecking(true)
    setError('')
    clearTimeout(timerRef.current)
    try {
      await persist(source)
      if (checkingRef.current !== job) return
      const result = await requestCorrection({ text: source.text, entryDate: source.date, signal: job.controller.signal })
      if (checkingRef.current !== job || draftRef.current.date !== job.date) return
      // Keep edits made during the check. Feedback still describes its source.
      const next = { ...draftRef.current, correction: { ...result, sourceText: source.text } }
      updateDraft(next)
      setSaveState('saving')
      await persist(next)
    } catch (checkError) {
      if (checkingRef.current === job && checkError.name !== 'AbortError') {
        setError(checkError.message || 'The correction failed. Please try again.')
        if (savedRef.current.get(draftRef.current.date) !== fingerprint(draftRef.current)) setSaveState('error')
      }
    } finally {
      if (checkingRef.current === job) {
        checkingRef.current = null
        setIsChecking(false)
      }
    }
  }

  const acceptCorrection = () => {
    const current = draftRef.current
    if (!current.correction || current.correction.sourceText !== current.text) return
    updateDraft({ ...current, text: current.correction.corrected,
      correction: { ...current.correction, sourceText: current.correction.corrected } })
    setSaveState('saving')
  }

  const remove = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    clearTimeout(timerRef.current)
    cancelCheck()
    const date = draftRef.current.date
    try {
      const task = queueRef.current.catch(() => null).then(() => deleteEntry(date))
      queueRef.current = task
      await task
      if (!mountedRef.current) return
      const empty = blankEntry(date)
      savedRef.current.set(date, fingerprint(empty))
      updateDraft(empty)
      updateEntries(entriesRef.current.filter((entry) => entry.date !== date))
      setSaveState('idle')
      setError('')
    } catch {
      if (mountedRef.current) setError('Could not delete this entry. Please try again.')
    } finally {
      busyRef.current = false
      if (mountedRef.current) setIsBusy(false)
    }
  }

  return { draft, entries, isLoading, isLoaded, isBusy, isChecking, saveState, error,
    edit, selectDate, check, acceptCorrection, remove, retrySave, retryLoad: () => setLoadVersion((version) => version + 1) }
}
