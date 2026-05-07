# JapanApp Backend Agent Rules

These rules apply to any AI agent editing the backend under `backend/`.

## Core Architecture

- Keep route modules thin. Routes should only parse input, call a service, and return a response.
- Put data access in `app/services/` and keep the DB connection helper in `app/services/db.py`.
- Split code by domain: `auth`, `kana`, `vocabulary`, `profile`, and future domains should each have their own service module.
- Avoid mixing transport code, auth code, and SQL in the same file.

## Database Rules

- Use the pooled PostgreSQL connection from `app/services/db.py` for direct database access.
- Prefer `get_db_cursor()` over manual connection open/close logic.
- Always return pooled connections in a `finally` path or the provided context manager.
- Keep queries parameterized. Never build SQL by concatenating user input.
- Fetch only the columns needed by the endpoint; do not over-select large tables.
- Use pagination or limits on any list endpoint that can grow unbounded.
- Use indexes and schema constraints as part of the design, not as an afterthought.

## Auth Rules

- Keep bearer-token validation separate from data access.
- Validate tokens in the auth dependency layer, then call the DB or service layer.
- Do not spread auth checks across route handlers if a dependency can enforce them once.
- User-owned data must always be filtered by `user_id` or equivalent ownership fields.
- Reference content can be read broadly only when the schema and PRD allow it.

## Route Design

- Route files should import service functions, not raw DB helpers.
- Keep response models close to the endpoint contract and ensure they match actual DB return types.
- If a DB timestamp is returned, use a datetime type in the response model unless the endpoint explicitly serializes to string.
- Preserve existing route paths and response shapes unless the frontend contract is intentionally changing.

## Pydantic and Serialization

- Match field types to real database values, especially for timestamps, arrays, JSONB, and enums.
- Use `Field(default_factory=list)` for mutable defaults.
- Return Pydantic models or plain dicts/lists that validate cleanly at the route boundary.

## Error Handling

- Raise HTTP errors with the smallest useful message for the client.
- Do not leak raw SQL, connection strings, or Supabase secrets in error messages.
- Keep repository/service errors contextual so the caller can understand which resource failed.

## Validation And Testing

- After any edit to a route, service, or model, run a narrow validation step when possible.
- Prefer a compile or syntax check for Python files before broader testing.
- For DB-backed changes, use the smallest direct smoke test that exercises the touched query.
- Do not widen the scope of changes in the same edit unless a validation result forces it.

## Practical Defaults

- Prefer clear, small modules over large generic utility files.
- Preserve the current FastAPI + Supabase hybrid approach unless a full migration is requested.
- When cleaning architecture, move one concern at a time: connection layer, auth dependencies, then resource services.
- Keep any new dependency pinned in `requirements.txt`.