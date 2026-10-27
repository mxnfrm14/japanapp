import { useMemo, useState } from "react";
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  FireIcon,
  FloppyDiskIcon,
  SparkleIcon,
  SpinnerGapIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import useDiary from "../hooks/useDiary";
import {
  DiaryHistoryDialog,
  DiaryWeekStrip,
} from "../components/DiaryCalendar";
import DiaryCorrectionPanel from "../components/DiaryCorrectionPanel";
import {
  calculateStreak,
  formatDateKey,
  shiftDateKey,
  toDateKey,
} from "../services/diaryStorage";
import { hasEntryContent } from "../utils/diaryCalendar";
import "./Diary.css";

function SaveStatus({ state, onRetry }) {
  return (
    <div className="diary-save">
      <span role="status" aria-live="polite">
        {state === "saving" ? (
          <>
            <SpinnerGapIcon className="diary-spinner" size={15} />
            Saving…
          </>
        ) : state === "saved" ? (
          <>
            <CheckCircleIcon size={15} />
            Saved
          </>
        ) : state === "error" ? (
          "Not saved"
        ) : (
          <>
            <FloppyDiskIcon size={15} />
            Autosave on
          </>
        )}
      </span>
      {state === "error" ? (
        <button type="button" onClick={onRetry}>
          Retry save
        </button>
      ) : null}
    </div>
  );
}

export default function Diary() {
  const diary = useDiary();
  const {
    draft,
    entries,
    isBusy,
    isLoading,
    isLoaded,
    isChecking,
    saveState,
    error,
  } = diary;
  const [historyOpen, setHistoryOpen] = useState(false);
  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const characters = Array.from(draft.text).length;
  const today = toDateKey();
  const isToday = draft.date === today;
  const isStale =
    Boolean(draft.correction) && draft.correction.sourceText !== draft.text;
  const disabled = isBusy || isLoading || !isLoaded;

  return (
    <div className="diary-page">
      <header className="diary-header">
        <div>
          <span className="diary-eyebrow">
            <span lang="ja">日々のことば</span> YOUR WRITING SPACE
          </span>
          <h1>
            Diary <span lang="ja">日記</span>
          </h1>
          <p>A little Japanese. A little more you.</p>
        </div>
        <div className="diary-header-actions">
          {streak > 0 ? (
            <span className="diary-streak">
              <FireIcon size={17} weight="fill" />
              {streak} day{streak === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            className="diary-button diary-button-secondary"
            onClick={() => setHistoryOpen(true)}
            disabled={disabled}
          >
            <ClockCounterClockwiseIcon size={19} />
            History
          </button>
        </div>
      </header>

      <div className="diary-date-toolbar">
        <div className="diary-selected-date">
          <CalendarBlankIcon size={20} />
          <div>
            <span className="diary-eyebrow">
              {isToday ? "TODAY’S PAGE" : "YOUR JOURNAL"}
            </span>
            <h2>{formatDateKey(draft.date)}</h2>
          </div>
        </div>
        <div className="diary-inline-actions">
          {!isToday ? (
            <button
              type="button"
              className="diary-today"
              onClick={() => diary.selectDate(today)}
              disabled={disabled}
            >
              Today
            </button>
          ) : null}
          <div className="diary-desktop-days">
            <button
              type="button"
              className="diary-icon-button"
              aria-label="Previous day"
              onClick={() => diary.selectDate(shiftDateKey(draft.date, -1))}
              disabled={disabled}
            >
              <CaretLeftIcon size={18} />
            </button>
            <button
              type="button"
              className="diary-icon-button"
              aria-label="Next day"
              onClick={() => diary.selectDate(shiftDateKey(draft.date, 1))}
              disabled={disabled || isToday}
            >
              <CaretRightIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <DiaryWeekStrip
        key={draft.date}
        dateKey={draft.date}
        entries={entries}
        onSelect={diary.selectDate}
        disabled={disabled}
      />

      {error ? (
        <div className="diary-error" role="alert">
          {error}
        </div>
      ) : null}
      {isLoading ? (
        <div className="diary-loading" role="status">
          <SpinnerGapIcon size={24} className="diary-spinner" />
          Opening your journal…
        </div>
      ) : !isLoaded ? (
        <div className="diary-loading">
          <p>Your journal could not be opened.</p>
          <button
            type="button"
            className="diary-button diary-button-secondary"
            onClick={diary.retryLoad}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="diary-workspace" aria-busy={isBusy}>
          <section
            className="diary-panel diary-editor"
            aria-labelledby="diary-editor-heading"
          >
            <header className="diary-panel-heading">
              <div>
                <span className="diary-eyebrow">MAKE A LITTLE ROOM</span>
                <h2 id="diary-editor-heading">What’s on your mind?</h2>
              </div>
              <SaveStatus state={saveState} onRetry={diary.retrySave} />
            </header>
            <div className="diary-title-field">
              <label htmlFor="diary-entry-title">
                Title <span>optional</span>
              </label>
              <input
                id="diary-entry-title"
                type="text"
                value={draft.title}
                onChange={(event) => diary.edit("title", event.target.value)}
                placeholder="Give this day a title…"
                disabled={isBusy}
              />
            </div>
            <label htmlFor="diary-entry-text" className="diary-text-label">
              Your entry
            </label>
            <textarea
              id="diary-entry-text"
              lang="ja"
              value={draft.text}
              onChange={(event) => diary.edit("text", event.target.value)}
              placeholder="今日は…"
              spellCheck={false}
              disabled={isBusy}
            />
            <div className="diary-editor-footer">
              <span className="diary-character-count">
                {characters.toLocaleString()} character
                {characters === 1 ? "" : "s"}
              </span>
              <div className="diary-inline-actions">
                {hasEntryContent(draft) || draft.id ? (
                  <button
                    type="button"
                    className="diary-icon-button diary-delete"
                    onClick={diary.remove}
                    disabled={isBusy}
                    aria-label="Delete this entry"
                  >
                    <TrashIcon size={18} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="diary-button diary-button-primary diary-check"
                  onClick={diary.check}
                  disabled={
                    isBusy ||
                    isChecking ||
                    !draft.text.trim() ||
                    characters > 5000
                  }
                >
                  {isChecking ? (
                    <SpinnerGapIcon size={18} className="diary-spinner" />
                  ) : (
                    <SparkleIcon size={18} weight="fill" />
                  )}
                  {isChecking
                    ? "Checking…"
                    : draft.correction
                      ? "Check again"
                      : "Check my Japanese"}
                </button>
              </div>
            </div>
            {characters > 5000 ? (
              <p className="diary-limit">
                Your entry is saved. To run a correction, shorten the text to
                5,000 characters or fewer.
              </p>
            ) : null}
          </section>
          <DiaryCorrectionPanel
            correction={draft.correction}
            isChecking={isChecking}
            isStale={isStale}
            onAccept={diary.acceptCorrection}
          />
        </div>
      )}

      {historyOpen ? (
        <DiaryHistoryDialog
          entries={entries}
          dateKey={draft.date}
          onSelect={diary.selectDate}
          onClose={() => setHistoryOpen(false)}
          isBusy={isBusy}
          error={error}
        />
      ) : null}
    </div>
  );
}
