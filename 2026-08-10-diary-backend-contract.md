# Diary — backend contract request

The diary feature is built and working in `frontend/`, but it persists entries in
`localStorage` because there is no `diary` table and no `/diary` routes yet. Everything below
is what the backend needs to expose so `frontend/src/services/diaryStorage.js` can be
re-pointed at the API. That file is the only swap point — no page or component touches
storage directly.

Correction itself needs **no new endpoint**: it runs through the existing `POST /ai/chat`
with a `system_prompt` built in `frontend/src/services/diaryCorrection.js`.

## Schema

```sql
create table public.diary_entry (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  entry_date  date not null,                    -- the writer's LOCAL calendar day
  text        text not null default '',
  correction  jsonb,                            -- last correction result, or null
  style_mode  text not null default 'auto',     -- 'auto' | 'plain' | 'polite'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)                  -- one entry per day, upserted
);

create index diary_entry_user_date_idx on public.diary_entry (user_id, entry_date desc);
```

RLS: same pattern as `user_vocabulary_state` — owner-only, `user_id = auth.uid()`.

Note `entry_date` is a **local** date supplied by the client as `YYYY-MM-DD`, not derived
server-side from `now()`. A diary day is the writer's day, and this app is used from a
non-UTC timezone.

`correction` jsonb shape (produced and validated by the frontend, stored opaquely):

```json
{
  "detected_register": "plain",
  "register_note": "…",
  "corrected": "…",
  "notes": [{ "original": "見た", "corrected": "見に行った", "kind": "conjugation", "explanation": "…" }],
  "encouragement": "…",
  "sourceText": "…",
  "localRegister": "plain",
  "checkedAt": "2026-08-10T09:00:00.000Z"
}
```

## Endpoints

| Method | Path | Query / body | Response |
|---|---|---|---|
| GET | `/diary/list` | `page`, `limit` (max 100), optional `from`/`to` as `YYYY-MM-DD` | `{ items, page, limit, has_more }` — same over-fetch-by-one convention as `/vocabulary/list` |
| GET | `/diary/{entry_date}` | — | entry object, or `404` |
| PUT | `/diary/{entry_date}` | `{ text, correction? }` | upserted entry object |
| DELETE | `/diary/{entry_date}` | — | `204` |

Entry object:

```json
{
  "id": "uuid",
  "date": "2026-08-10",
  "text": "今日は…",
  "correction": { … } | null,
  "created_at": "…",
  "updated_at": "…"
}
```

The frontend field is `date`, not `entry_date` — either rename in the response or the
mapping goes in `diaryStorage.js`.

`PUT` (upsert on `(user_id, entry_date)`) rather than `POST` is deliberate: the editor
autosaves every ~1.2s, so writes must be idempotent per day.

### Frontend prerequisite

`frontend/src/services/api.js` currently exposes only `get` and `post`. `put` and `delete`
need adding there (per `frontend/CLAUDE.md`, in that module — not via raw `fetch` in a page).

## Optional, not required

`style_mode` is a per-user preference, not per-entry; it currently lives in `localStorage`.
If `profile` gains a `diary_style_mode` column it should move there so it follows the user
across devices. The column is included on `diary_entry` above only if you prefer recording
which mode a given correction ran under.
