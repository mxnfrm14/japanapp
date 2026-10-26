"""Favorites data access. Every operation is scoped to the authenticated user."""

from app.models.favorites import FavoriteType
from app.services.db import get_db_cursor

# Identifiers only come from this fixed mapping, never from request strings.
_TARGETS = {
    "vocabulary": ("vocabulary_item_id", "vocabulary_item"),
    "kanji": ("kanji_item_id", "kanji_item"),
}


def fetch_favorites(user_id: str, page: int, limit: int, item_type: FavoriteType | None = None):
    query = """
        SELECT CASE WHEN f.vocabulary_item_id IS NOT NULL THEN 'vocabulary' ELSE 'kanji' END AS item_type,
               COALESCE(f.vocabulary_item_id, f.kanji_item_id) AS item_id,
               COALESCE(v.japanese, k.kanji) AS japanese,
               COALESCE(v.reading, NULLIF(array_to_string(k.onyomi || k.kunyomi, ' · '), '')) AS reading,
               COALESCE(v.meaning, k.meaning) AS meaning,
               COALESCE(v.difficulty_level, k.jlpt_level) AS jlpt_level,
               f.created_at
        FROM public.favorite f
        LEFT JOIN public.vocabulary_item v ON v.id = f.vocabulary_item_id
        LEFT JOIN public.kanji_item k ON k.id = f.kanji_item_id
        WHERE f.user_id = %s
    """
    params = [user_id]
    if item_type is not None:
        column, _ = _TARGETS[item_type]
        query += f" AND f.{column} IS NOT NULL"
    query += " ORDER BY f.created_at DESC, f.id DESC LIMIT %s OFFSET %s"
    params.extend([limit + 1, (page - 1) * limit])
    with get_db_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    return [dict(row) for row in rows[:limit]], len(rows) > limit


def fetch_favorite_ids(user_id: str, item_type: FavoriteType, item_ids: list[str]) -> list[str]:
    if not item_ids:
        return []
    column, _ = _TARGETS[item_type]
    with get_db_cursor() as cur:
        cur.execute(
            f"SELECT {column} AS item_id FROM public.favorite "
            f"WHERE user_id = %s AND {column} = ANY(%s::uuid[])",
            [user_id, item_ids],
        )
        return [str(row["item_id"]) for row in cur.fetchall()]


def add_favorite(user_id: str, item_type: FavoriteType, item_id: str) -> bool:
    """Idempotently save an existing reference item, preserving its original date."""
    column, table = _TARGETS[item_type]
    with get_db_cursor() as cur:
        cur.execute(
            f"""
                INSERT INTO public.favorite (user_id, {column})
                SELECT %s, id FROM public.{table} WHERE id = %s
                ON CONFLICT (user_id, {column}) WHERE {column} IS NOT NULL
                DO UPDATE SET {column} = EXCLUDED.{column}
                RETURNING id
            """,
            [user_id, item_id],
        )
        return cur.fetchone() is not None


def delete_favorite(user_id: str, item_type: FavoriteType, item_id: str) -> None:
    column, _ = _TARGETS[item_type]
    with get_db_cursor() as cur:
        cur.execute(
            f"DELETE FROM public.favorite WHERE user_id = %s AND {column} = %s",
            [user_id, item_id],
        )


def import_vocabulary_favorites(user_id: str, item_ids: list[str]) -> None:
    """Migrate browser bookmarks, ignoring deleted words and existing favorites."""
    with get_db_cursor() as cur:
        cur.execute(
            """
                INSERT INTO public.favorite (user_id, vocabulary_item_id)
                SELECT %s, id FROM public.vocabulary_item WHERE id = ANY(%s::uuid[])
                ON CONFLICT DO NOTHING
            """,
            [user_id, item_ids],
        )
