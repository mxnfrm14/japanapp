"""Unified search helpers for vocabulary and kanji."""

from typing import Any

from app.services.db import get_db_cursor


def _normalize_search_row(row: dict[str, Any], item_type: str) -> dict[str, Any]:
    """Normalize a database row into the shared search response shape."""
    readings = row.get("readings") or []
    if not readings and row.get("reading"):
        readings = [row["reading"]]

    return {
        "id": row.get("id"),
        "japanese": row.get("japanese"),
        "reading": row.get("reading"),
        "readings": readings,
        "meaning": row.get("meaning"),
        "tags": row.get("tags") or [],
        "difficulty_level": row.get("difficulty_level"),
        "frequency_rank": row.get("frequency_rank"),
        "type": item_type,
    }


def search_vocabulary_and_kanji(
    q: str,
    limit: int = 20,
    jlpt: int | None = None,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    """Search vocabulary and kanji using parameterized SQL queries."""
    search_pattern = f"%{q}%"

    vocabulary_query = """
        SELECT id, japanese, reading, meaning, tags, difficulty_level, frequency_rank
        FROM public.vocabulary_item
        WHERE (japanese ILIKE %s OR reading ILIKE %s OR meaning ILIKE %s)
    """
    vocabulary_params: list[Any] = [search_pattern, search_pattern, search_pattern]

    if jlpt is not None:
        vocabulary_query += " AND difficulty_level = %s"
        vocabulary_params.append(jlpt)

    if tag:
        vocabulary_query += " AND tags @> %s"
        vocabulary_params.append([tag])

    vocabulary_query += " ORDER BY frequency_rank ASC NULLS LAST, japanese ASC LIMIT %s"
    vocabulary_params.append(limit)

    kanji_query = """
        SELECT id, kanji AS japanese, NULL AS reading, onyomi, kunyomi, meaning,
               NULL AS tags, NULL AS difficulty_level, NULL AS frequency_rank
        FROM public.kanji_item
        WHERE (
            kanji ILIKE %s
            OR meaning ILIKE %s
            OR EXISTS (
                SELECT 1
                FROM unnest(COALESCE(onyomi, ARRAY[]::text[]) || COALESCE(kunyomi, ARRAY[]::text[])) AS reading
                WHERE reading ILIKE %s
            )
        )
        ORDER BY kanji ASC
        LIMIT %s
    """
    kanji_params: list[Any] = [search_pattern, search_pattern, search_pattern, limit]

    with get_db_cursor() as cur:
        cur.execute(vocabulary_query, vocabulary_params)
        vocabulary_rows = cur.fetchall()

        cur.execute(kanji_query, kanji_params)
        kanji_rows = cur.fetchall()

    items = [
        _normalize_search_row(dict(row), "vocabulary")
        for row in vocabulary_rows
    ]
    items.extend(_normalize_search_row(dict(row), "kanji") for row in kanji_rows)
    return items[:limit]
