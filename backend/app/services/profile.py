"""Profile data access helpers."""

from typing import Any

from app.services.db import get_db_cursor


def fetch_profile(user_id: str) -> dict[str, Any] | None:
    """Fetch a user profile row by auth user id."""
    query = """
        SELECT id, display_name, avatar_url, locale, created_at, updated_at
        FROM public.profile
        WHERE id = %s
        LIMIT 1
    """

    with get_db_cursor() as cur:
        cur.execute(query, (user_id,))
        row = cur.fetchone()

    return dict(row) if row else None