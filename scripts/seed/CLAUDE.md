# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: `scripts/seed/` — the one-time pipeline that populates the reference tables from open data.

These scripts are **operational tooling, not application code**. They are run by hand against the real
Supabase project and are not part of the app build or CI. Don't run them as a side effect of another task.

`README.md` here is the source of truth for the run order, expected durations, and row counts. Read it
before touching anything; it is written in French.

## Key properties

- Numbered execution order (`01_` → `06_`). Later scripts assume earlier ones completed.
- Mixed runtimes on purpose: Python scripts use `supabase-py`, `.mjs` scripts use `@supabase/supabase-js` v2
  plus `unofficial-jisho-api` (which is why the Jisho-facing steps are Node).
- **Every script must stay idempotent and resumable.** Inserts use `upsert` with `ignore_duplicates`, and the
  enrichment steps select only rows with a missing field so an interrupted run resumes where it stopped.
  Preserve this property in any edit — phase 2 takes ~3h at Jisho's 1 req/s rate limit.
- Auth uses `SUPABASE_SERVICE_KEY` (service role, bypasses RLS) from a local `.env` in this folder. Never
  move that key toward the frontend or commit it.

The un-numbered `link_kanji_vocab.py` is superseded by `04_link_kanji_vocab.py`.

`03b_seed_missing_kanji.mjs` and `03c_fill_kanji_jlpt.mjs` are follow-up patch scripts for gaps left by
`03_seed_kanji.mjs`, not part of the original documented sequence.

Schema being filled: `vocabulary_item`, `kanji_item`, `kana_item`, `kanji_vocabulary_link` — defined in
`supabase/migrations/init_japanapp.sql`.
