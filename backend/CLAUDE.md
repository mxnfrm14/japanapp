# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: `backend/` — the FastAPI service.

## Do not edit this directory from this repository

The backend is deployed and maintained **on a separate server**, by a different agent working there. This
copy exists so frontend work can read the real API contract. Read freely — routes, Pydantic models, SQL in
services — but make no edits here unless the user explicitly asks for a backend change in this repo.

When the frontend needs an API change (new filter, new sort, new endpoint), don't implement it here: state
precisely what the backend needs to expose (path, query params, response shape) so it can be requested from
the server-side agent, and build the frontend against that contract.

`AGENTS.md` in this folder holds the full editing rules for whoever does change the backend; read it before
any sanctioned edit.

## Commands (for reproducing CI or local inspection)

```bash
uv sync
uv run python -m compileall app   # the only check CI runs
./start.sh                        # uvicorn app.main:app on 0.0.0.0:8000
```

Docs are served at `/docs` on the running instance — the fastest way to confirm live request/response shapes.
`pytest` is a dev dependency and `conftest.py` exists, but the CI test step is commented out.

## Structure

`app/main.py` creates the app, wires CORS from `settings.cors_origins`, and includes one router per domain.
Every domain is split three ways, and edits stay in the matching layer:

- `app/routes/<domain>.py` — thin: parse query params, call a service, wrap failures in `HTTPException`
- `app/services/<domain>.py` — all SQL, using `get_db_cursor()`
- `app/models/<domain>.py` — Pydantic request/response models

Domains: `auth`, `ai`, `kana`, `kanji`, `search`, `vocabulary` (+ `profile`, `db`, `services` service-only modules).

## Data access

`app/services/db.py` owns a module-level `psycopg2` `SimpleConnectionPool` (1–10 connections) built lazily
from `settings.database_url`. `get_db_cursor()` is a context manager that yields a `RealDictCursor`
(pass `dict_cursor=False` for tuples), commits on success, rolls back on exception, and always returns the
connection to the pool.

So there are **two** paths to Supabase: direct SQL over psycopg2 for data reads, and the Supabase REST/Auth
API (`app/services/services.py`) for authentication. Auth token validation is a live HTTP call to
`/auth/v1/user` on every protected request.

Pagination convention used by list endpoints: query `limit + 1` rows, and if the extra row came back, report
`has_more: true` and truncate. `limit` is capped at 100 by `Query(le=100)`.

`app/config.py` is a `pydantic-settings` `Settings` loaded from `backend/.env` — required keys include
`supabase_url`, `supabase_key`, `supabase_service_key`, `database_url`, `jwt_secret`.

## Schema

The authoritative DDL is `supabase/migrations/init_japanapp.sql`; the design rationale, indexes, and RLS
intent are in `pp.md` at the repo root.
