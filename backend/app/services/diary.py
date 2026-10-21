"""Diary entry data access helpers."""

from datetime import date
from typing import Any, Optional

from psycopg2.extras import Json

from app.services.db import get_db_cursor


def _row_to_entry(row: dict[str, Any]) -> dict[str, Any]:
    entry = dict(row)
    entry["date"] = entry.pop("entry_date")
    return entry


def fetch_diary_list(
    user_id: str,
    page: int,
    limit: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch a paginated diary list for one user, newest day first."""
    offset = (page - 1) * limit
    request_limit = limit + 1

    query = """
        SELECT id, entry_date, text, correction, created_at, updated_at
        FROM public.diary_entry
        WHERE user_id = %s
    """
    params: list[Any] = [user_id]

    if date_from is not None:
        query += " AND entry_date >= %s"
        params.append(date_from)

    if date_to is not None:
        query += " AND entry_date <= %s"
        params.append(date_to)

    query += " ORDER BY entry_date DESC"
    query += " LIMIT %s OFFSET %s"
    params.extend([request_limit, offset])

    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    items = [_row_to_entry(row) for row in rows]
    has_more = len(items) > limit
    return items[:limit], has_more


def fetch_diary_entry(user_id: str, entry_date: date) -> dict[str, Any] | None:
    """Fetch the entry for one user on one calendar day."""
    query = """
        SELECT id, entry_date, text, correction, created_at, updated_at
        FROM public.diary_entry
        WHERE user_id = %s AND entry_date = %s
        LIMIT 1
    """

    with get_db_cursor() as cur:
        cur.execute(query, [user_id, entry_date])
        row = cur.fetchone()

    return _row_to_entry(row) if row else None


def fetch_recent_diary_entries(user_id: str, before_date: date, limit: int = 3) -> list[dict[str, Any]]:
    """Fetch the writer's own recent non-empty entries strictly before a day, newest first."""
    query = """
        SELECT id, entry_date, text, correction, created_at, updated_at
        FROM public.diary_entry
        WHERE user_id = %s AND entry_date < %s AND text <> ''
        ORDER BY entry_date DESC
        LIMIT %s
    """

    with get_db_cursor() as cur:
        cur.execute(query, [user_id, before_date, limit])
        rows = cur.fetchall()

    return [_row_to_entry(row) for row in rows]


def upsert_diary_entry(
    user_id: str,
    entry_date: date,
    text: str,
    correction: Optional[dict[str, Any]],
) -> dict[str, Any]:
    """Create or replace the entry for one calendar day (idempotent per day)."""
    query = """
        INSERT INTO public.diary_entry (user_id, entry_date, text, correction)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, entry_date)
        DO UPDATE SET text = EXCLUDED.text, correction = EXCLUDED.correction, updated_at = now()
        RETURNING id, entry_date, text, correction, created_at, updated_at
    """
    correction_param = Json(correction) if correction is not None else None

    with get_db_cursor() as cur:
        cur.execute(query, [user_id, entry_date, text, correction_param])
        row = cur.fetchone()

    return _row_to_entry(row)


def delete_diary_entry(user_id: str, entry_date: date) -> None:
    """Delete the entry for one calendar day, if any."""
    query = """
        DELETE FROM public.diary_entry
        WHERE user_id = %s AND entry_date = %s
    """

    with get_db_cursor() as cur:
        cur.execute(query, [user_id, entry_date])
