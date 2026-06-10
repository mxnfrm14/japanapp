"""Vocabulary data access helpers."""

from typing import Any, Optional

from app.services.db import get_db_cursor


def fetch_vocabulary(
    page: int,
    limit: int,
    jlpt: Optional[int] = None,
    tag: Optional[str] = None,
) -> tuple[list[dict[str, Any]], bool]:
    """Fetch paginated vocabulary with optional JLPT and tag filters."""
    offset = (page - 1) * limit
    request_limit = limit + 1

    query = """
        SELECT id, japanese, reading, meaning, tags, difficulty_level, frequency_rank, created_at
        FROM public.vocabulary_item
        WHERE 1=1
    """
    params = []

    if jlpt is not None:
        query += " AND difficulty_level = %s"
        params.append(jlpt)

    if tag:
        query += " AND tags @> %s"
        params.append([tag])

    query += " ORDER BY frequency_rank ASC NULLS LAST, japanese ASC, created_at ASC"
    query += f" LIMIT {request_limit} OFFSET {offset}"

    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    items = [dict(row) for row in rows]
    has_more = len(items) > limit
    return items[:limit], has_more


def fetch_vocabulary_tags() -> list[str]:
    """Fetch all unique tags across vocabulary items."""
    query = """
        SELECT DISTINCT unnest(tags) AS tag
        FROM public.vocabulary_item
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
        ORDER BY tag ASC
    """

    with get_db_cursor(dict_cursor=False) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    return [row[0] for row in rows if row[0]]

def fetch_vocabulary_item(vocabulary_id: str) -> dict[str, Any] | None:
    """Fetch a single vocabulary item by id."""
    query = """
        SELECT id, japanese, reading, meaning, example_sentence, example_translation,
               kanji_breakdown, tags, jisho_url, difficulty_level, frequency_rank, created_at
        FROM public.vocabulary_item
        WHERE id = %s
        LIMIT 1
    """

    with get_db_cursor() as cur:
        cur.execute(query, [vocabulary_id])
        row = cur.fetchone()

    return dict(row) if row else None