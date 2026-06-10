"""Smoke tests for unified search."""

from contextlib import contextmanager

from app.services.search import search_vocabulary_and_kanji


class _FakeCursor:
    def __init__(self):
        self.calls = []
        self._rows = []

    def execute(self, query, params):
        self.calls.append((query, params))
        if "public.vocabulary_item" in query:
            self._rows = [
                {
                    "id": "v1",
                    "japanese": "日本語",
                    "reading": "にほんご",
                    "meaning": "Japanese language",
                    "tags": ["noun"],
                    "difficulty_level": 3,
                    "frequency_rank": 10,
                }
            ]
        else:
            self._rows = [
                {
                    "id": "k1",
                    "japanese": "日",
                    "reading": None,
                    "readings": ["ニチ", "ひ", "び", "か"],
                    "meaning": "sun; day",
                    "tags": None,
                    "difficulty_level": None,
                    "frequency_rank": None,
                }
            ]

    def fetchall(self):
        return self._rows


@contextmanager
def _fake_get_db_cursor():
    cursor = _FakeCursor()
    yield cursor


def test_search_vocabulary_and_kanji_smoke(monkeypatch):
    from app.services import search as search_service

    monkeypatch.setattr(search_service, "get_db_cursor", _fake_get_db_cursor)

    items = search_vocabulary_and_kanji(q="日", limit=2, jlpt=3, tag="noun")

    assert len(items) == 2
    assert items[0]["type"] == "vocabulary"
    assert items[0]["japanese"] == "日本語"
    assert items[0]["tags"] == ["noun"]
    assert items[1]["type"] == "kanji"
    assert items[1]["japanese"] == "日"
    assert items[1]["reading"] is None
    assert items[1]["readings"] == ["ニチ", "ひ", "び", "か"]
