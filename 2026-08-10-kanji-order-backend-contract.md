# Backend change request — `order` param on `GET /kanji/list`

**Requested by:** frontend (`frontend/src/pages/Kanji.jsx`)
**Date:** 2026-08-10
**Scope:** `backend/app/routes/kanji.py`, `backend/app/services/kanji.py`. No model or schema change.

## Why

The Kanji page now uses infinite scroll (`useInfiniteKanji` in `frontend/src/hooks/useApi.js`), so it only
ever holds a few pages in memory and **cannot sort client-side** — sorting a partial list reorders rows as
new pages arrive.

Before infinite scroll, the page sorted the full list by JLPT level N5 → N1, then frequency rank. Today
`fetch_kanji` only orders by `frequency_rank ASC NULLS LAST, kanji ASC, created_at ASC`, so on "All levels"
the JLPT grouping is gone. `/vocabulary/list` already solved exactly this with its `order` param; `/kanji/list`
needs the same thing.

## Contract to implement

`GET /kanji/list` gains one query param, mirroring `/vocabulary/list`:

| Param | Type | Default | Validation | Meaning |
|---|---|---|---|---|
| `order` | `str` | `"desc"` | `pattern="^(asc\|desc)$"` | Sort direction on `jlpt_level`. `desc` = N5 → N1 (easiest first), `asc` = N1 → N5. |

`jlpt_level` is stored as the JLPT number (5 = N5, easiest), same convention as `vocabulary_item.difficulty_level`
— so `DESC` is "easiest first". Keep that mapping identical to vocabulary so the two pages behave the same way.

Everything else is unchanged: existing `page`, `limit` (≤100), `jlpt_level`, `radical` params, the
`{ items, page, limit, has_more }` response shape, and the `limit + 1` over-fetch convention.

Requests that omit `order` must keep working. Note the default flips the current behavior from frequency-rank
order to N5-first; that is intended and matches the pre-infinite-scroll UI.

## 1. `backend/app/routes/kanji.py`

Add the param to `fetch_kanji_list` and pass it through:

```python
@kanji_router.get("/list", response_model=KanjiListResponse)
def fetch_kanji_list(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    jlpt_level: int | None = Query(default=None, ge=1, le=5),
    radical: str | None = Query(default=None),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    token: str = Depends(get_auth_token),
):
    """Fetch a paginated kanji list with optional filters.

    - `jlpt_level` / `radical`: filters.
    - `order`: sort direction by JLPT level, `desc` (N5 -> N1) or `asc`.
    """
    try:
        items, has_more = fetch_kanji(
            page=page,
            limit=limit,
            jlpt_level=jlpt_level,
            radical=radical,
            order=order,
        )
        return KanjiListResponse(items=items, page=page, limit=limit, has_more=has_more)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
```

## 2. `backend/app/services/kanji.py`

Add `order: str = "desc"` to `fetch_kanji` and change only the `ORDER BY` clause:

```python
def fetch_kanji(
    page: int,
    limit: int,
    jlpt_level: int | None = None,
    radical: str | None = None,
    order: str = "desc",
) -> tuple[list[dict[str, Any]], bool]:
```

```python
    direction = "DESC" if order == "desc" else "ASC"
    query += (
        f" ORDER BY jlpt_level {direction} NULLS LAST,"
        " frequency_rank ASC NULLS LAST, kanji ASC, created_at ASC"
    )
    query += " LIMIT %s OFFSET %s"
    params.extend([request_limit, offset])
```

Two things to be careful about:

- `direction` must stay a whitelisted literal derived from the value (`"DESC" if order == "desc" else "ASC"`),
  never the raw `order` string interpolated into SQL. The route's `pattern` is the first guard; this is the second.
- Keep `LIMIT %s OFFSET %s` **parameterized**, as `fetch_kanji` already does. Do not copy the f-string
  interpolation of `limit`/`offset` used in `fetch_vocabulary` — the kanji version is the correct pattern.

The tie-breakers after `jlpt_level` matter for pagination correctness: with a stable total ordering, page 2
can't repeat or skip rows that page 1 already returned. `kanji ASC, created_at ASC` gives that.

## 3. Index (check before adding)

The new sort is `ORDER BY jlpt_level, frequency_rank` with an optional `jlpt_level = %s` filter and deep
`OFFSET`s from infinite scroll. If `public.kanji_item` has no supporting index, consider:

```sql
CREATE INDEX IF NOT EXISTS idx_kanji_item_level_rank
    ON public.kanji_item (jlpt_level DESC NULLS LAST, frequency_rank ASC NULLS LAST);
```

The table is small (JLPT kanji only), so this is a nice-to-have, not a blocker. If added, it belongs in
`supabase/migrations/` per the schema rules, not as an ad-hoc statement.

## Acceptance checks

```bash
uv run python -m compileall app   # the CI gate

# N5 first (default)
curl "$HOST/kanji/list?limit=5" -H "Authorization: Bearer $TOKEN"
curl "$HOST/kanji/list?limit=5&order=desc" -H "Authorization: Bearer $TOKEN"
# -> identical payloads, jlpt_level starts at 5

# N1 first
curl "$HOST/kanji/list?limit=5&order=asc" -H "Authorization: Bearer $TOKEN"
# -> jlpt_level starts at 1

# filter still works, and order is a no-op within one level
curl "$HOST/kanji/list?limit=5&jlpt_level=5&order=asc" -H "Authorization: Bearer $TOKEN"

# rejected
curl "$HOST/kanji/list?order=random" -H "Authorization: Bearer $TOKEN"   # -> 422

# no overlap across page boundary
curl "$HOST/kanji/list?limit=50&page=1" ...
curl "$HOST/kanji/list?limit=50&page=2" ...   # -> disjoint id sets
```

Also confirm `/docs` shows `order` on `/kanji/list`.

## Frontend side (handled here, not on the server)

Once this is deployed, `useInfiniteKanji` in `frontend/src/hooks/useApi.js` gains an `order` option passed as
the `order` param and added to its query key, and `Kanji.jsx` gets the same asc/desc arrow toggle
`Vocabulary.jsx` already has. No frontend change is needed for the backend work to land — the current
frontend simply never sends `order` and gets the new default.
