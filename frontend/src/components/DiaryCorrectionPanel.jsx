import { useMemo } from 'react'
import { CheckCircleIcon, SparkleIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import { charDiff, countDiffChanges } from '../utils/japaneseStyle'

export default function DiaryCorrectionPanel({ correction, isChecking, isStale, onAccept }) {
  const segments = useMemo(() => correction ? charDiff(correction.sourceText || '', correction.corrected) : [], [correction])
  const notes = correction?.notes || []
  const changeCount = countDiffChanges(segments)
  const isClean = correction && changeCount === 0 && notes.length === 0

  return (
    <section className="diary-panel diary-feedback" aria-labelledby="diary-feedback-title" aria-busy={isChecking}>
      <header className="diary-panel-heading">
        <div><span className="diary-eyebrow">A LITTLE GUIDANCE</span><h2 id="diary-feedback-title">Your Japanese, refined.</h2></div>
        <SparkleIcon size={23} className="diary-accent" weight="duotone" />
      </header>
      {isChecking ? (
        <div className="diary-feedback-empty" role="status"><SpinnerGapIcon size={32} className="diary-spinner" /><h3>Reading your words…</h3><p>Checking your Japanese while keeping your writing style.</p></div>
      ) : !correction ? (
        <div className="diary-feedback-empty"><span className="diary-feedback-symbol" lang="ja" aria-hidden="true">文</span><h3>Keep your own voice.</h3><p>Write a few sentences, then check your Japanese. Your corrections and explanations will appear here.</p></div>
      ) : (
        <div className="diary-feedback-content">
          <div className="diary-feedback-summary"><span className={`diary-feedback-tag ${isClean ? 'is-clean' : ''}`}>{isClean ? <CheckCircleIcon size={16} /> : <SparkleIcon size={16} />}{isClean ? 'Reads naturally' : `${notes.length || changeCount} ${notes.length ? 'note' : 'change'}${(notes.length || changeCount) === 1 ? '' : 's'}`}</span></div>
          {isStale ? <p className="diary-stale" role="status">Your entry has changed since this check. Check again for up-to-date feedback.</p> : null}
          {correction.register_note ? <p className="diary-feedback-description">{correction.register_note}</p> : null}
          {isClean ? <p className="diary-clean-message">No corrections needed. Your entry reads naturally as written. <span lang="ja">完璧！</span></p> : (
            <div className="diary-diff" lang="ja" aria-label="Corrected entry with changes">
              {segments.map((segment, index) => segment.type === 'del'
                ? <del key={index}>{segment.text}</del>
                : segment.type === 'ins' ? <ins key={index}>{segment.text}</ins> : <span key={index}>{segment.text}</span>)}
            </div>
          )}
          {notes.length ? (
            <ol className="diary-notes">
              {notes.map((note, index) => (
                <li key={index}>
                  <span className="diary-note-number">{index + 1}</span>
                  <div><div className="diary-note-change" lang="ja"><del>{note.original}</del><span aria-hidden="true">→</span><ins>{note.corrected}</ins></div><span className="diary-note-kind">{note.kind}</span><p>{note.explanation}</p></div>
                </li>
              ))}
            </ol>
          ) : null}
          {!isClean ? <button type="button" onClick={onAccept} disabled={isStale} className="diary-button diary-button-secondary diary-apply"><CheckCircleIcon size={18} />Apply to my entry</button> : null}
          {correction.encouragement ? <p className="diary-encouragement">{correction.encouragement}</p> : null}
        </div>
      )}
    </section>
  )
}
