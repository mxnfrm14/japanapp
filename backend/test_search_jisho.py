"""Regression tests for on-demand Jisho imports, without external services."""

from contextlib import contextmanager
from copy import deepcopy
import os
from unittest.mock import Mock, patch

import httpx
import pytest

# Imports must work without a developer's .env or a live database.
with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.invalid",
    "SUPABASE_KEY": "test",
    "SUPABASE_SERVICE_KEY": "test",
    "DATABASE_URL": "postgresql://localhost/japanapp_test",
    "JWT_SECRET": "test",
    "DEBUG": "false",
}):
    from app.models.search import SearchItem
    from app.services import db, jisho, search, vocabulary


ENTRY = {
    "japanese": [{"word": "自転車", "reading": "じてんしゃ"}],
    "senses": [{"english_definitions": ["bicycle", "bike"], "parts_of_speech": ["Noun (common) (futsuumeishi)"]}],
    "jlpt": ["jlpt-n5"],
    "is_common": True,
}
ROW = {
    "id": "7b09c39a-105e-4010-8886-2647f7db3207",
    "japanese": "自転車",
    "reading": "じてんしゃ",
    "meaning": "bicycle; bike",
    "tags": ["noun common futsuumeishi"],
    "difficulty_level": 5,
    "frequency_rank": 100,
}
EXAMPLE_HTML = """
<div class="sentence_content">
  <ul class="japanese_sentence japanese" lang="ja">
    <li><span class="furigana">じてんしゃ</span><span class="unlinked">自転車</span></li>
    に<img src="test.png"><li><span class="furigana">の</span><span class="unlinked">乗る</span></li>。
  </ul>
  <span class="english">I ride a bicycle &amp; enjoy it.</span>
</div>
<div class="sentence_content"><span class="english">A second example.</span></div>
"""


@pytest.fixture
def cursors(monkeypatch):
    local = Mock()
    local.fetchall.side_effect = [[], []]
    imported = Mock()
    imported.fetchone.side_effect = [None, dict(ROW)]

    @contextmanager
    def local_cursor():
        yield local

    @contextmanager
    def import_cursor():
        yield imported

    monkeypatch.setattr(search, "get_db_cursor", local_cursor)
    monkeypatch.setattr(vocabulary, "get_db_cursor", import_cursor)
    return local, imported


@pytest.fixture
def jisho_server(monkeypatch):
    client_type = httpx.Client
    requests = []

    def install(word_response=None, example_response=None):
        def respond(request):
            requests.append(request)
            value = word_response if request.url.path == "/api/v1/search/words" else example_response
            if isinstance(value, Exception):
                raise value
            if isinstance(value, httpx.Response):
                return value
            if request.url.path == "/api/v1/search/words":
                return httpx.Response(200, json={"data": [deepcopy(ENTRY)]} if value is None else value)
            return httpx.Response(200, text=EXAMPLE_HTML)

        monkeypatch.setattr(jisho, "REQUEST_INTERVAL", 0)
        monkeypatch.setattr(
            jisho.httpx, "Client",
            lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs),
        )
        return requests

    return install


def test_missing_word_is_enriched_saved_linked_and_returned(cursors, jisho_server):
    requests = jisho_server()
    _, imported = cursors

    result = search.search_vocabulary_and_kanji("  jitensha  ")

    assert len(result) == 1
    item = SearchItem.model_validate(result[0])
    assert item.id == ROW["id"]
    assert item.japanese == "自転車"
    assert item.readings == ["じてんしゃ"]
    assert item.type == "vocabulary"
    assert requests[0].url.params["keyword"] == "jitensha"
    assert requests[1].url.path.endswith("自転車#sentences")
    insert = next(call for call in imported.execute.call_args_list if "INSERT INTO public.vocabulary_item" in call.args[0])
    values = insert.args[1]
    assert values[:5] == ["自転車", "じてんしゃ", "bicycle; bike", ["noun common futsuumeishi"], 5]
    assert 1 <= values[5] <= 8000
    assert values[6].startswith("https://jisho.org/search/")
    assert values[7:] == ["自転車に乗る。", "I ride a bicycle & enjoy it."]
    assert imported.execute.call_args.args[1] == [ROW["id"], "自", ["自", "転", "車"]]


@pytest.mark.parametrize("item_type", ["vocabulary", "kanji"])
def test_local_results_do_not_call_jisho(cursors, monkeypatch, item_type):
    local, _ = cursors
    local.fetchall.side_effect = [[dict(ROW, relevance_score=1)], []] if item_type == "vocabulary" else [[], [dict(ROW, relevance_score=1)]]
    fetch = Mock(side_effect=AssertionError("Unexpected Jisho request"))
    monkeypatch.setattr(search, "fetch_jisho_vocabulary", fetch)

    assert search.search_vocabulary_and_kanji("自転車")[0]["type"] == item_type
    fetch.assert_not_called()


def test_repeated_search_uses_the_imported_word(cursors, jisho_server):
    requests = jisho_server()
    local, imported = cursors
    local.fetchall.side_effect = [[], [], [dict(ROW, relevance_score=1)], []]

    first = search.search_vocabulary_and_kanji("自転車")
    second = search.search_vocabulary_and_kanji("自転車")

    assert first == second
    assert len(requests) == 2  # Word and example on the first search only.
    assert imported.fetchone.call_count == 2


@pytest.mark.parametrize("kwargs", [{"jlpt": 4}, {"tag": "verb"}])
def test_jisho_result_must_match_filters(cursors, jisho_server, kwargs):
    jisho_server()
    _, imported = cursors

    assert search.search_vocabulary_and_kanji("自転車", **kwargs) == []
    imported.execute.assert_not_called()


def test_matching_filters_and_vocabulary_prefix_allow_import(cursors, jisho_server):
    jisho_server()
    result = search.search_vocabulary_and_kanji(
        "自転車", type_filter="vocabulary", jlpt=5, tag="noun common futsuumeishi",
    )
    assert result[0]["id"] == ROW["id"]
    assert cursors[0].execute.call_count == 1


def test_empty_and_kanji_only_queries_do_not_import(cursors, monkeypatch):
    fetch = Mock(side_effect=AssertionError("Unexpected Jisho request"))
    monkeypatch.setattr(search, "fetch_jisho_vocabulary", fetch)

    assert search.search_vocabulary_and_kanji("   ") == []
    cursors[0].execute.assert_not_called()
    assert search.search_vocabulary_and_kanji("車", type_filter="kanji") == []
    fetch.assert_not_called()


@pytest.mark.parametrize("response", [
    {"data": []},
    {"data": [{"japanese": [{"word": "自転車"}], "senses": []}]},
    {"data": [dict(ENTRY, senses=[{"english_definitions": []}])]},
    {"data": "invalid"},
    httpx.Response(200, text="invalid json"),
    httpx.Response(429),
    httpx.ReadTimeout("Jisho timed out"),
])
def test_missing_or_unavailable_jisho_keeps_search_empty(cursors, jisho_server, response):
    requests = jisho_server(word_response=response)

    assert search.search_vocabulary_and_kanji("自転車") == []
    assert len(requests) == 1
    cursors[1].execute.assert_not_called()


def test_example_failure_does_not_prevent_import(cursors, jisho_server):
    jisho_server(example_response=httpx.Response(503))

    assert search.search_vocabulary_and_kanji("自転車")[0]["id"] == ROW["id"]
    insert = next(call for call in cursors[1].execute.call_args_list if "INSERT INTO public.vocabulary_item" in call.args[0])
    assert insert.args[1][-2:] == [None, None]


def test_exact_match_and_alternate_spelling_are_preferred(jisho_server):
    jisho_server(word_response={"data": [
        dict(ENTRY, japanese=[{"word": "自転車道", "reading": "じてんしゃどう"}]),
        dict(ENTRY, japanese=[{"word": "チャリンコ", "reading": "ちゃりんこ"}, {"word": "自転車", "reading": "じてんしゃ"}]),
    ]})

    item = jisho.fetch_jisho_vocabulary("自転車")
    assert item["japanese"] == "自転車"
    assert item["reading"] == "じてんしゃ"


def test_kana_only_word_without_jlpt_or_frequency_is_supported(jisho_server):
    jisho_server(word_response={"data": [dict(
        ENTRY, japanese=[{"reading": "きらきら"}], jlpt=[], is_common=False,
    )]})

    item = jisho.fetch_jisho_vocabulary("きらきら")
    assert item["japanese"] == item["reading"] == "きらきら"
    assert item["difficulty_level"] is None
    assert item["frequency_rank"] is None


def test_existing_word_is_reused_without_overwriting_seed_data(cursors):
    _, imported = cursors
    imported.fetchone.side_effect = [dict(ROW)]

    assert vocabulary.import_vocabulary_item(dict(ROW, meaning="a different definition")) == ROW
    assert all("INSERT INTO public.vocabulary_item" not in call.args[0] for call in imported.execute.call_args_list)


def test_concurrent_unique_conflict_reuses_the_persisted_id(cursors):
    _, imported = cursors
    imported.fetchone.side_effect = [None, None, dict(ROW)]

    result = vocabulary.import_vocabulary_item(dict(ROW))

    assert result["id"] == ROW["id"]
    assert imported.execute.call_args.args[1][0] == ROW["id"]


def test_link_failure_rolls_back_the_word_and_releases_the_connection(monkeypatch):
    cursor = Mock()
    cursor.fetchone.side_effect = [None, dict(ROW)]

    def execute(query, params):
        if "INSERT INTO public.kanji_vocabulary_link" in query:
            raise RuntimeError("Link insert failed")

    cursor.execute.side_effect = execute
    connection = Mock()
    connection.cursor.return_value.__enter__ = Mock(return_value=cursor)
    connection.cursor.return_value.__exit__ = Mock(return_value=False)
    release = Mock()
    monkeypatch.setattr(db, "get_db_connection", Mock(return_value=connection))
    monkeypatch.setattr(db, "release_db_connection", release)

    with pytest.raises(RuntimeError, match="Link insert failed"):
        vocabulary.import_vocabulary_item(dict(ROW))

    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()
    release.assert_called_once_with(connection)
