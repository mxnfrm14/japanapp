"""Kana data access helpers."""

from typing import Any

from app.services.db import get_db_cursor


def fetch_kana(script_type: str | None = None) -> list[dict[str, Any]]:
    """Fetch kana reference rows, optionally filtered by script_type."""
    query = """
        SELECT id, script_type, character, romaji, group_name, stroke_count, order_index, created_at
        FROM public.kana_item
        WHERE 1=1
    """
    params: list[Any] = []

    if script_type:
        query += " AND script_type = %s"
        params.append(script_type)

    query += " ORDER BY script_type ASC, order_index ASC"

    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    return [dict(r) for r in rows]