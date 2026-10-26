"""Favorites API validation, ownership boundaries and optional PostgreSQL smoke test."""

from datetime import datetime, timezone
from contextlib import contextmanager
import os
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg2 import OperationalError
import psycopg2
from psycopg2.extras import RealDictCursor
import pytest

with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.invalid",
    "SUPABASE_KEY": "test",
    "SUPABASE_SERVICE_KEY": "test",
    "DATABASE_URL": "postgresql://localhost/japanapp_test",
    "JWT_SECRET": "test",
    "DEBUG": "false",
}):
    from app.dependencies.auth import get_current_user
    from app.routes import favorites
    from app.services import favorites as favorite_service


USER_ID = str(uuid4())
ITEM_ID = str(uuid4())


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(favorites.favorites_router)
    app.dependency_overrides[get_current_user] = lambda: {"id": USER_ID}
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("item_type", ["vocabulary", "kanji"])
def test_saving_uses_authenticated_owner(client, monkeypatch, item_type):
    save = Mock(return_value=True)
    monkeypatch.setattr(favorites, "add_favorite", save)

    response = client.put(f"/favorites/{item_type}/{ITEM_ID}", json={"user_id": str(uuid4())})

    assert response.status_code == 204
    assert response.content == b""
    save.assert_called_once_with(USER_ID, item_type, ITEM_ID)


def test_missing_reference_item_returns_404(client, monkeypatch):
    monkeypatch.setattr(favorites, "add_favorite", Mock(return_value=False))
    assert client.put(f"/favorites/kanji/{ITEM_ID}").status_code == 404


def test_delete_is_scoped_to_owner(client, monkeypatch):
    delete = Mock()
    monkeypatch.setattr(favorites, "delete_favorite", delete)
    assert client.delete(f"/favorites/vocabulary/{ITEM_ID}").status_code == 204
    delete.assert_called_once_with(USER_ID, "vocabulary", ITEM_ID)


def test_paginated_list_serializes_and_filters(client, monkeypatch):
    fetch = Mock(return_value=([{
        "item_type": "kanji", "item_id": ITEM_ID, "japanese": "日",
        "meaning": "day", "created_at": datetime.now(timezone.utc),
    }], True))
    monkeypatch.setattr(favorites, "fetch_favorites", fetch)

    response = client.get("/favorites?page=2&limit=10&item_type=kanji")

    assert response.status_code == 200
    assert response.json()["has_more"] is True
    assert response.json()["items"][0]["item_id"] == ITEM_ID
    fetch.assert_called_once_with(USER_ID, 2, 10, "kanji")


def test_status_only_checks_requested_items_for_owner(client, monkeypatch):
    fetch = Mock(return_value=[ITEM_ID])
    monkeypatch.setattr(favorites, "fetch_favorite_ids", fetch)

    response = client.post("/favorites/status", json={"item_type": "vocabulary", "item_ids": [ITEM_ID]})

    assert response.json() == {"item_ids": [ITEM_ID]}
    fetch.assert_called_once_with(USER_ID, "vocabulary", [ITEM_ID])


def test_import_is_scoped_to_owner(client, monkeypatch):
    importer = Mock()
    monkeypatch.setattr(favorites, "import_vocabulary_favorites", importer)
    assert client.post("/favorites/import", json={"item_ids": [ITEM_ID]}).status_code == 204
    importer.assert_called_once_with(USER_ID, [ITEM_ID])


@pytest.mark.parametrize("method,path,body", [
    ("put", f"/favorites/kana/{ITEM_ID}", None),
    ("put", "/favorites/kanji/invalid-uuid", None),
    ("delete", f"/favorites/kana/{ITEM_ID}", None),
    ("get", "/favorites?page=0", None),
    ("get", "/favorites?limit=101", None),
    ("get", "/favorites?item_type=kana", None),
    ("post", "/favorites/status", {"item_type": "kanji", "item_ids": ["invalid-uuid"]}),
    ("post", "/favorites/status", {"item_type": "kanji", "item_ids": [ITEM_ID] * 101}),
    ("post", "/favorites/import", {"item_ids": [ITEM_ID] * 101}),
])
def test_invalid_inputs_are_rejected(client, method, path, body):
    assert client.request(method, path, json=body).status_code == 422


@pytest.mark.parametrize("method,path,body", [
    ("get", "/favorites", None),
    ("put", f"/favorites/kanji/{ITEM_ID}", None),
    ("delete", f"/favorites/kanji/{ITEM_ID}", None),
    ("post", "/favorites/status", {"item_type": "kanji", "item_ids": []}),
    ("post", "/favorites/import", {"item_ids": []}),
])
def test_authentication_is_required(client, method, path, body):
    client.app.dependency_overrides.clear()
    assert client.request(method, path, json=body).status_code == 401


def test_database_error_does_not_expose_connection_details(client, monkeypatch):
    monkeypatch.setattr(favorites, "fetch_favorites", Mock(side_effect=OperationalError("secret-database-url")))
    response = client.get("/favorites")
    assert response.status_code == 500
    assert "secret-database-url" not in response.text


@pytest.mark.skipif(not os.environ.get("FAVORITES_TEST_DATABASE_URL"), reason="Requires a migrated PostgreSQL database")
def test_database_persistence_constraints_and_rls(monkeypatch):
    """Exercise real queries and RLS; all test records are rolled back."""
    conn = psycopg2.connect(os.environ["FAVORITES_TEST_DATABASE_URL"], connect_timeout=8)

    @contextmanager
    def transaction_cursor():
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur

    monkeypatch.setattr(favorite_service, "get_db_cursor", transaction_cursor)
    user_a, user_b = str(uuid4()), str(uuid4())
    word_id, kanji_id = str(uuid4()), str(uuid4())
    try:
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = '10s'")
            cur.execute("INSERT INTO auth.users (id) VALUES (%s), (%s)", [user_a, user_b])
            cur.execute("INSERT INTO public.vocabulary_item (id, japanese) VALUES (%s, 'お気に入り')", [word_id])
            cur.execute("INSERT INTO public.kanji_item (id, kanji, meaning) VALUES (%s, %s, 'test')", [kanji_id, kanji_id])

        assert favorite_service.add_favorite(user_a, "vocabulary", word_id)
        original_date = favorite_service.fetch_favorites(user_a, 1, 20)[0][0]["created_at"]
        assert favorite_service.add_favorite(user_a, "vocabulary", word_id)
        rows, has_more = favorite_service.fetch_favorites(user_a, 1, 20)
        assert len(rows) == 1 and not has_more
        assert rows[0]["created_at"] == original_date
        assert favorite_service.add_favorite(user_a, "kanji", kanji_id)
        assert favorite_service.add_favorite(user_b, "vocabulary", word_id)
        assert not favorite_service.add_favorite(user_a, "kanji", str(uuid4()))
        assert favorite_service.fetch_favorite_ids(user_a, "vocabulary", [word_id]) == [word_id]
        assert favorite_service.fetch_favorite_ids(user_b, "kanji", [kanji_id]) == []
        rows, has_more = favorite_service.fetch_favorites(user_a, 1, 1)
        assert len(rows) == 1 and has_more
        rows, has_more = favorite_service.fetch_favorites(user_a, 2, 1)
        assert len(rows) == 1 and not has_more
        assert len(favorite_service.fetch_favorites(user_a, 1, 20, "kanji")[0]) == 1

        favorite_service.delete_favorite(user_a, "vocabulary", word_id)
        favorite_service.delete_favorite(user_a, "vocabulary", word_id)
        assert favorite_service.fetch_favorite_ids(user_a, "vocabulary", [word_id]) == []
        assert favorite_service.fetch_favorite_ids(user_b, "vocabulary", [word_id]) == [word_id]
        favorite_service.import_vocabulary_favorites(user_a, [word_id, str(uuid4())])
        favorite_service.import_vocabulary_favorites(user_a, [word_id])
        assert len(favorite_service.fetch_favorites(user_a, 1, 20)[0]) == 2

        with conn.cursor() as cur:
            cur.execute("SAVEPOINT invalid_favorite")
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur.execute(
                    "INSERT INTO public.favorite (user_id, vocabulary_item_id, kanji_item_id) VALUES (%s, %s, %s)",
                    [user_a, word_id, kanji_id],
                )
            cur.execute("ROLLBACK TO SAVEPOINT invalid_favorite")
            cur.execute("SAVEPOINT duplicate_favorite")
            with pytest.raises(psycopg2.errors.UniqueViolation):
                cur.execute("INSERT INTO public.favorite (user_id, vocabulary_item_id) VALUES (%s, %s)", [user_a, word_id])
            cur.execute("ROLLBACK TO SAVEPOINT duplicate_favorite")

            cur.execute("SET LOCAL ROLE authenticated")
            cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", [user_a])
            cur.execute("SELECT DISTINCT user_id::text FROM public.favorite")
            assert cur.fetchall() == [(user_a,)]
            cur.execute("DELETE FROM public.favorite WHERE user_id = %s", [user_b])
            assert cur.rowcount == 0
            cur.execute("SAVEPOINT unauthorized_favorite")
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("INSERT INTO public.favorite (user_id, kanji_item_id) VALUES (%s, %s)", [user_b, kanji_id])
            cur.execute("ROLLBACK TO SAVEPOINT unauthorized_favorite")
    finally:
        conn.rollback()
        conn.close()
