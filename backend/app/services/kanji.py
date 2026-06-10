"""Kanji data access helpers."""

from typing import Any

from app.services.db import get_db_cursor


def fetch_kanji(
    page: int,
    limit: int,
    jlpt_level: int | None = None,
    radical: str | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch paginated kanji rows with optional JLPT/radical filters."""
    offset = (page - 1) * limit
    request_limit = limit + 1

    query = """
        SELECT
            id,
            kanji,
            meaning,
            onyomi,
            kunyomi,
            stroke_count,
            radical,
            jlpt_level,
            frequency_rank,
            components,
            stroke_order_gif_uri,
            notes,
            created_at,
            updated_at
        FROM public.kanji_item
        WHERE 1=1
    """
    params: list[Any] = []

    if jlpt_level is not None:
        query += " AND jlpt_level = %s"
        params.append(jlpt_level)

    if radical:
        query += " AND radical = %s"
        params.append(radical)

    query += " ORDER BY frequency_rank ASC NULLS LAST, kanji ASC, created_at ASC"
    query += " LIMIT %s OFFSET %s"
    params.extend([request_limit, offset])

    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    items = [dict(row) for row in rows]
    has_more = len(items) > limit
    return items[:limit], has_more


def fetch_kanji_item(kanji_id: str) -> dict[str, Any] | None:
    """Fetch a single kanji item by id."""
    query = """
        SELECT id, kanji, meaning, onyomi, kunyomi, stroke_count, radical, jlpt_level,
               frequency_rank, components, stroke_order_gif_uri, notes, created_at
        FROM public.kanji_item
        WHERE id = %s
        LIMIT 1
    """

    with get_db_cursor() as cur:
        cur.execute(query, [kanji_id])
        row = cur.fetchone()

    return dict(row) if row else None