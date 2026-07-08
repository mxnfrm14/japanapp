"""Unified search helpers for vocabulary and kanji."""

from typing import Any

from app.services.db import get_db_cursor


def _normalize_search_row(row: dict[str, Any], item_type: str) -> dict[str, Any]:
    """Normalize a database row into the shared search response shape."""
    readings = row.get("readings") or []
    if not readings and row.get("reading"):
        if item_type == "kanji" and isinstance(row["reading"], str):
            readings = [reading for reading in row["reading"].split(", ") if reading]
        else:
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
        "relevance_score": row.get("relevance_score"),
        "type": item_type,
    }


def search_vocabulary_and_kanji(
    q: str,
    limit: int = 20,
    jlpt: int | None = None,
    tag: str | None = None,
    type_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Search vocabulary and kanji using parameterized SQL queries."""
    search_pattern = f"%{q}%"
    prefix_pattern = f"{q}%"

    vocabulary_rows: list[dict[str, Any]] = []
    kanji_rows: list[dict[str, Any]] = []

    with get_db_cursor() as cur:
        if type_filter != "kanji":
            vocabulary_query = """
                SELECT id, japanese, reading, meaning, tags, difficulty_level, frequency_rank,
                  CASE
                    WHEN japanese = %s OR reading = %s OR meaning = %s THEN 1
                    WHEN japanese ILIKE %s OR reading ILIKE %s OR meaning ILIKE %s THEN 2
                    ELSE 3
                  END AS relevance_score
                FROM public.vocabulary_item
                WHERE (japanese ILIKE %s OR reading ILIKE %s OR meaning ILIKE %s)
            """
            vocabulary_params: list[Any] = [
                q,
                q,
                q,
                prefix_pattern,
                prefix_pattern,
                prefix_pattern,
                search_pattern,
                search_pattern,
                search_pattern,
            ]

            if jlpt is not None:
                vocabulary_query += " AND difficulty_level = %s"
                vocabulary_params.append(jlpt)

            if tag:
                vocabulary_query += " AND tags @> %s"
                vocabulary_params.append([tag])

            vocabulary_query += " ORDER BY relevance_score ASC, frequency_rank ASC NULLS LAST, japanese ASC LIMIT %s"
            vocabulary_params.append(limit)

            cur.execute(vocabulary_query, vocabulary_params)
            vocabulary_rows = cur.fetchall()

        if type_filter != "vocabulary":
            kanji_query = """
                SELECT id, kanji AS japanese,
                  COALESCE(
                    NULLIF(array_to_string(onyomi, ', '), ''),
                    array_to_string(kunyomi, ', ')
                  ) AS reading,
                  meaning, NULL AS tags, NULL AS difficulty_level, frequency_rank,
                  CASE
                    WHEN kanji = %s OR meaning = %s THEN 1
                    WHEN kanji ILIKE %s OR meaning ILIKE %s THEN 2
                    ELSE 3
                  END AS relevance_score
                FROM public.kanji_item
                WHERE kanji ILIKE %s OR meaning ILIKE %s
                  OR EXISTS (
                    SELECT 1 FROM unnest(
                      COALESCE(onyomi, ARRAY[]::text[]) || COALESCE(kunyomi, ARRAY[]::text[])
                    ) AS r WHERE r ILIKE %s
                  )
                ORDER BY relevance_score ASC, frequency_rank ASC NULLS LAST
                LIMIT %s
            """
            kanji_params: list[Any] = [
                q,
                q,
                prefix_pattern,
                prefix_pattern,
                search_pattern,
                search_pattern,
                search_pattern,
                limit,
            ]

            cur.execute(kanji_query, kanji_params)
            kanji_rows = cur.fetchall()

    items = [
        _normalize_search_row(dict(row), "vocabulary")
        for row in vocabulary_rows
    ]
    items.extend(_normalize_search_row(dict(row), "kanji") for row in kanji_rows)
    return sorted(items, key=lambda item: item["relevance_score"] or 99)[:limit]
