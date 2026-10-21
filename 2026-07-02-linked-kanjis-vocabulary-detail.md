# Linked Kanjis on Vocabulary Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display clickable kanji chips on the vocabulary detail page, each linked to its kanji detail page, sourced from the existing `kanji_vocabulary_link` join table.

**Architecture:** Extend the existing `GET /vocabulary/{vocabulary_id}` endpoint to include a `linked_kanjis` list (defaulting to `[]` when none exist). Add a `KanjiChip` component on the frontend and replace the raw JSON `kanji_breakdown` section with these chips.

**Tech Stack:** FastAPI + psycopg2 (backend), React 19 + React Router 7 + TailwindCSS v4 (frontend)

## Global Constraints

- `linked_kanjis` must default to `[]` — never cause errors when no links exist for a word
- Frontend must not call Supabase directly — all data via FastAPI backend
- Use `font-cjk` Tailwind class for kanji character rendering (existing convention)
- Primary accent color: `#8f0020` (use `text-primary` or existing CSS variables, not hardcoded hex)
- No new API endpoints — extend the existing detail endpoint only

---

## Pre-requisite: Fix missing kanji-vocabulary links

Before implementing the UI, audit and repair missing links in `kanji_vocabulary_link`.
Run this SQL in the Supabase SQL editor:

```sql
-- Audit: see which links are missing
SELECT v.id, v.japanese, k.id AS kanji_id, k.kanji
FROM vocabulary_item v
CROSS JOIN LATERAL (
  SELECT DISTINCT unnest(regexp_matches(v.japanese, '[一-鿿]', 'g')) AS ch
) chars
JOIN kanji_item k ON k.kanji = chars.ch
LEFT JOIN kanji_vocabulary_link kvl
  ON kvl.vocabulary_item_id = v.id AND kvl.kanji_id = k.id
WHERE kvl.id IS NULL;

-- Fix: insert all missing links at once
INSERT INTO kanji_vocabulary_link (kanji_id, vocabulary_item_id, is_common)
SELECT DISTINCT k.id, v.id, true
FROM vocabulary_item v
CROSS JOIN LATERAL (
  SELECT DISTINCT unnest(regexp_matches(v.japanese, '[一-鿿]', 'g')) AS ch
) chars
JOIN kanji_item k ON k.kanji = chars.ch
LEFT JOIN kanji_vocabulary_link kvl
  ON kvl.vocabulary_item_id = v.id AND kvl.kanji_id = k.id
WHERE kvl.id IS NULL
ON CONFLICT (kanji_id, vocabulary_item_id) DO NOTHING;
```

Alternatively, re-run `scripts/seed/04_link_kanji_vocab.py` if it handles conflicts (idempotent).

---

## Files Modified / Created

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/vocabulary.py` | Modify | Add `LinkedKanji` model; add `linked_kanjis` field to `VocabularyDetailItem` |
| `backend/app/services/vocabulary.py` | Modify | Query `kanji_vocabulary_link` JOIN `kanji_item` in `fetch_vocabulary_item()` |
| `frontend/src/components/KanjiChip.jsx` | Create | Reusable clickable kanji chip component |
| `frontend/src/pages/VocabularyDetail.jsx` | Modify | Replace raw `kanji_breakdown` `<pre>` with `KanjiChip` grid |

---

### Task 1: Add `LinkedKanji` Pydantic model and update `VocabularyDetailItem`

**Files:**
- Modify: `backend/app/models/vocabulary.py`

**Interfaces:**
- Produces: `LinkedKanji` (id: str, kanji: str, meaning: str, jlpt_level: int | None)
- Produces: `VocabularyDetailItem.linked_kanjis: list[LinkedKanji]` (default `[]`)

- [ ] **Step 1: Open and read the current models file**

  File: `backend/app/models/vocabulary.py`

  Current `VocabularyDetailItem`:
  ```python
  class VocabularyDetailItem(VocabularyItem):
      example_sentence: Optional[str] = None
      example_translation: Optional[str] = None
      kanji_breakdown: Optional[Any] = None
      jisho_url: Optional[str] = None
  ```

- [ ] **Step 2: Add `LinkedKanji` model and extend `VocabularyDetailItem`**

  Add above `VocabularyDetailItem`:
  ```python
  class LinkedKanji(BaseModel):
      id: str
      kanji: str
      meaning: str
      jlpt_level: Optional[int] = None
  ```

  Update `VocabularyDetailItem`:
  ```python
  class VocabularyDetailItem(VocabularyItem):
      example_sentence: Optional[str] = None
      example_translation: Optional[str] = None
      kanji_breakdown: Optional[Any] = None
      jisho_url: Optional[str] = None
      linked_kanjis: list[LinkedKanji] = []
  ```

  Ensure `Optional` is imported from `typing` (or use Python 3.10+ syntax — check what the file already uses).

- [ ] **Step 3: Verify syntax**

  ```bash
  cd backend && uv run python -m compileall app/models/vocabulary.py
  ```
  Expected: `Listing 'app/models/vocabulary.py'...` with no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/models/vocabulary.py
  git commit -m "feat(backend): add LinkedKanji model to vocabulary detail response"
  ```

---

### Task 2: Fetch linked kanjis in `fetch_vocabulary_item` service

**Files:**
- Modify: `backend/app/services/vocabulary.py`

**Interfaces:**
- Consumes: DB pool from `app.services.db` (already used in this file)
- Produces: `fetch_vocabulary_item()` returns dict with `linked_kanjis: list[dict]` key (empty list when none found)

- [ ] **Step 1: Read the current service**

  File: `backend/app/services/vocabulary.py`

  The function `fetch_vocabulary_item(vocabulary_id: str)` currently:
  1. Opens a DB connection from the pool
  2. Runs a single SELECT on `vocabulary_item` WHERE `id = %s`
  3. Returns the row as a dict, or None

- [ ] **Step 2: Add the linked kanjis query inside `fetch_vocabulary_item`**

  After the existing vocabulary item SELECT (and after the `if row is None: return None` guard), add a second query using the **same connection/cursor**:

  ```python
  # Fetch linked kanjis (empty list if none)
  cur.execute(
      """
      SELECT k.id, k.kanji, k.meaning, k.jlpt_level
      FROM kanji_vocabulary_link kvl
      JOIN kanji_item k ON kvl.kanji_id = k.id
      WHERE kvl.vocabulary_item_id = %s
      ORDER BY k.frequency_rank ASC NULLS LAST
      """,
      (vocabulary_id,)
  )
  kanji_rows = cur.fetchall()
  kanji_cols = [desc[0] for desc in cur.description]
  linked_kanjis = [dict(zip(kanji_cols, r)) for r in kanji_rows]
  ```

  Then add `linked_kanjis` to the returned dict:
  ```python
  item = dict(zip(cols, row))
  item["linked_kanjis"] = linked_kanjis
  return item
  ```

  Note: `id` from the kanji table is a UUID — psycopg2 may return it as a uuid object. Cast to `str` if needed:
  ```python
  linked_kanjis = [
      {**dict(zip(kanji_cols, r)), "id": str(r[0])}
      for r in kanji_rows
  ]
  ```
  (Index `0` = `k.id`, which is first in the SELECT.)

- [ ] **Step 3: Verify syntax**

  ```bash
  cd backend && uv run python -m compileall app/services/vocabulary.py
  ```
  Expected: no errors.

- [ ] **Step 4: Manual smoke test**

  ```bash
  uvicorn app.main:app --reload
  curl -s http://localhost:8000/vocabulary/<any_vocab_id> \
    -H "Authorization: Bearer <token>" | python3 -m json.tool | grep -A 10 linked_kanjis
  ```
  Expected: `"linked_kanjis": [...]` — either populated or `[]`, never an error.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/app/services/vocabulary.py
  git commit -m "feat(backend): include linked kanjis in vocabulary detail endpoint"
  ```

---

### Task 3: Create `KanjiChip` component

**Files:**
- Create: `frontend/src/components/KanjiChip.jsx`

**Interfaces:**
- Consumes: `{ id: string, kanji: string, meaning: string, jlpt_level: number | null }`
- Produces: Clickable chip; navigates to `/kanji/:id` on click

- [ ] **Step 1: Check CSS variable names in `frontend/src/index.css`**

  Look for variable names like `--color-border`, `--color-card`, `--color-text-secondary`, `--color-primary`. Note the exact names used — they will be used in the component.

- [ ] **Step 2: Create the component file**

  ```jsx
  // frontend/src/components/KanjiChip.jsx
  import { useNavigate } from "react-router-dom";

  export default function KanjiChip({ id, kanji, meaning, jlpt_level }) {
    const navigate = useNavigate();

    return (
      <button
        onClick={() => navigate(`/kanji/${id}`)}
        className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
      >
        <span className="font-cjk text-2xl leading-none text-[var(--color-text-primary)]">
          {kanji}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)] max-w-[80px] truncate">
          {meaning}
        </span>
        {jlpt_level && (
          <span className="text-[10px] font-medium text-[var(--color-primary)] uppercase tracking-wide">
            N{jlpt_level}
          </span>
        )}
      </button>
    );
  }
  ```

  Adjust CSS variable names to match exactly what was found in `index.css`.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/components/KanjiChip.jsx
  git commit -m "feat(frontend): add KanjiChip reusable component"
  ```

---

### Task 4: Update `VocabularyDetail.jsx` to render linked kanji chips

**Files:**
- Modify: `frontend/src/pages/VocabularyDetail.jsx`

**Interfaces:**
- Consumes: `item.linked_kanjis: Array<{ id, kanji, meaning, jlpt_level }>` from the backend response
- Consumes: `KanjiChip` from `frontend/src/components/KanjiChip.jsx`

- [ ] **Step 1: Read the current detail page**

  File: `frontend/src/pages/VocabularyDetail.jsx`

  Locate the kanji breakdown section — it looks like:
  ```jsx
  {item.kanji_breakdown && (
    <DetailRow label="Kanji Breakdown">
      <pre className="...">
        {formatStructuredValue(item.kanji_breakdown)}
      </pre>
    </DetailRow>
  )}
  ```

- [ ] **Step 2: Replace the kanji breakdown section**

  Add import at the top of the file:
  ```jsx
  import KanjiChip from "../components/KanjiChip";
  ```

  Replace the `kanji_breakdown` block with:
  ```jsx
  {item.linked_kanjis?.length > 0 && (
    <DetailRow label="Kanji">
      <div className="flex flex-wrap gap-2">
        {item.linked_kanjis.map((k) => (
          <KanjiChip
            key={k.id}
            id={k.id}
            kanji={k.kanji}
            meaning={k.meaning}
            jlpt_level={k.jlpt_level}
          />
        ))}
      </div>
    </DetailRow>
  )}
  ```

  The `?.length > 0` guard hides the section entirely for kana-only words — no empty row, no error.

- [ ] **Step 3: Run the frontend linter**

  ```bash
  cd frontend && pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification**

  ```bash
  # Terminal 1
  cd backend && uvicorn app.main:app --reload

  # Terminal 2
  cd frontend && pnpm dev
  ```

  1. Open `http://localhost:5173` and log in
  2. Navigate to a word with kanji (e.g. 日本語, 学校, 食べる) — kanji chips should appear
  3. Click a chip — should navigate to the correct `/kanji/:id` detail page
  4. Navigate to a kana-only word (e.g. ありがとう) — the Kanji section should be completely absent

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/VocabularyDetail.jsx
  git commit -m "feat(frontend): show linked kanji chips on vocabulary detail page"
  ```

---

## Verification Checklist

- [ ] `GET /vocabulary/:id` returns `linked_kanjis: []` for kana-only words
- [ ] `GET /vocabulary/:id` returns `linked_kanjis: [{id, kanji, meaning, jlpt_level}]` for words with kanji
- [ ] Vocabulary detail page shows kanji chips when links exist
- [ ] Vocabulary detail page shows no Kanji section when no links exist
- [ ] Clicking a kanji chip navigates to the correct `/kanji/:id` page
- [ ] `pnpm lint` passes
- [ ] `uv run python -m compileall app` passes
