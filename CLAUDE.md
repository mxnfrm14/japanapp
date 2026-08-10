# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement (read first)

**In this repository, only `frontend/` is edited.** The backend runs on a separate server and is maintained there by a different agent. `backend/` is present here as a **read-only contract reference**: read routes, models, and services to learn the exact API shape, but do not modify them. Same for `supabase/` and `scripts/seed/` unless explicitly asked.

Each major directory has its own `CLAUDE.md` with rules for that part of the app:
- `frontend/CLAUDE.md` — the part you actually change
- `backend/CLAUDE.md` — read-only reference + backend conventions (also see `backend/AGENTS.md`)
- `scripts/seed/CLAUDE.md` — one-off data seeding pipeline

## Repository layout

```
frontend/   React 19 + Vite 8 + Tailwind v4 + daisyUI (the app UI)
backend/    FastAPI, deployed elsewhere — reference only
supabase/   migrations/init_japanapp.sql — full DB schema
scripts/    seed/ — one-time data ingestion from JLPT lists + Jisho
pp.md       Product requirements document (PRD) + full data model + architecture rationale
```

`pp.md` is the authoritative product/data spec. When a question is about *why* something is modeled a
way (daily word carry-over, deck deletion rules, mastery source of truth, RLS), the answer is in `pp.md`,
not in the code.

## Commands

```bash
# Frontend (from frontend/)
pnpm install
pnpm dev        # Vite dev server on :5173
pnpm lint       # ESLint flat config — CI gate
pnpm build      # CI gate

# Backend (from backend/, only relevant when reproducing CI locally)
uv sync
uv run python -m compileall app     # the "test" CI runs today
./start.sh                          # uvicorn on :8000
```

There is no frontend test suite. CI (`.github/workflows/ci.yml`) runs on push/PR to `main` and `dev`:
frontend `pnpm lint` + `pnpm build`, backend `compileall` (pytest is commented out). `deploy.yml` builds
a backend Docker image to GHCR; its deploy step is an unfinished TODO.

Branches: work happens on `dev`; `main` is the deploy branch.

## Architecture

Strict three-hop flow — **the frontend never talks to Supabase or Ollama directly**:

```
React (Vite) --HTTP--> FastAPI --> Postgres (Supabase) via psycopg2 pool
                              \--> Supabase Auth REST (token validation)
                              \--> Ollama / Mistral (AI)
```

Auth is a Supabase-issued JWT held in `localStorage.authToken`. `frontend/src/services/api.js` attaches it
as `Bearer`; any 401 clears storage and hard-redirects to `/login`. On the backend, `get_auth_token`
re-validates the token against Supabase `/auth/v1/user` on every request.

RLS exists in Postgres as defense-in-depth, but the FastAPI layer is the real access-control boundary.

### API surface (as deployed today)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login`, `/auth/signup`, `/auth/logout` | returns `{ user, session }` |
| GET | `/auth/me` | used by `initializeAuth` |
| GET | `/vocabulary/list` | `page`, `limit` (max **100**), `jlpt`, `tag` → `{ items, page, limit, has_more }` |
| GET | `/vocabulary/tags` | `{ tags: string[] }` |
| GET | `/vocabulary/{id}` | detail + `linked_kanjis` |
| GET | `/kanji/list`, `/kanji/{id}` | |
| GET | `/kana`, `/kana/hiragana`, `/kana/katakana` | |
| GET | `/search?q=&limit=` | |
| POST | `/ai/chat`, `/ai/chat/stream` | |
| GET | `/health` | |

Endpoints referenced in `frontend/src/utils/constants.js` and `hooks/useApi.js` that do **not** exist yet:
`/dashboard/summary`, `/flashcards/due`, `/flashcards/submit`, `/auth/refresh`, `/ai/inline`. Don't assume
a hook works just because it's defined — check the route list above.

Pagination is mandatory on list endpoints (`has_more` is computed by over-fetching one row), so the
frontend must paginate rather than pulling whole tables.
