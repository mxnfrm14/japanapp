"""Diary title compatibility and correction policy without external services."""

from contextlib import contextmanager
from datetime import date, datetime, timezone
import os
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.invalid", "SUPABASE_KEY": "test",
    "SUPABASE_SERVICE_KEY": "test", "DATABASE_URL": "postgresql://localhost/japanapp_test",
    "JWT_SECRET": "test", "DEBUG": "false",
}):
    from app.dependencies.auth import get_current_user
    from app.models.diary import CorrectionRequest
    from app.routes import diary as routes
    from app.services import diary as service
    from app.services import diary_correction as correction_service


DAY = date(2026, 10, 27)
STAMP = datetime(2026, 10, 27, tzinfo=timezone.utc)
ENTRY = {"id": "entry-id", "date": DAY, "title": "My day", "text": "今日は楽しかった。",
         "correction": None, "created_at": STAMP, "updated_at": STAMP}


class DiaryRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(routes.diary_router)
        app.dependency_overrides[get_current_user] = lambda: {"id": "owner-id"}
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_titles_round_trip_and_user_is_taken_from_auth(self):
        with patch.object(routes, "upsert_diary_entry", return_value=ENTRY) as save:
            response = self.client.put('/diary/2026-10-27', json={"title": "My day", "text": ENTRY["text"], "user_id": "other-user"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "My day")
        save.assert_called_once_with(user_id="owner-id", entry_date=DAY, title="My day", text=ENTRY["text"], correction=None)

    def test_omitted_title_and_explicit_clear_are_distinct(self):
        for body, expected_title in (({"text": "Body"}, None), ({"title": "", "text": "Body"}, "")):
            with self.subTest(body=body), patch.object(routes, "upsert_diary_entry", return_value=ENTRY) as save:
                self.assertEqual(self.client.put('/diary/2026-10-27', json=body).status_code, 200)
                self.assertEqual(save.call_args.kwargs["title"], expected_title)

    def test_list_and_single_entry_include_titles(self):
        with patch.object(routes, "fetch_diary_entry", return_value=ENTRY), patch.object(routes, "fetch_diary_list", return_value=([ENTRY], False)):
            self.assertEqual(self.client.get('/diary/2026-10-27').json()["title"], "My day")
            self.assertEqual(self.client.get('/diary/list').json()["items"][0]["title"], "My day")

    def test_legacy_style_preference_cannot_select_a_target_register(self):
        body = {"text": "本を読みました。", "style_mode": "plain", "entry_date": "2026-10-27"}
        payload = CorrectionRequest.model_validate(body)
        self.assertNotIn("style_mode", payload.model_dump())
        with patch.object(routes, "request_correction", return_value={"corrected": body["text"]}) as correct:
            response = self.client.post('/diary/correct', json=body)
        self.assertEqual(response.status_code, 200)
        correct.assert_called_once_with(user_id="owner-id", text=body["text"], entry_date=DAY)

    def test_correction_size_limit_still_applies(self):
        self.assertEqual(self.client.post('/diary/correct', json={"text": "あ" * 5001}).status_code, 422)


class DiaryServiceTests(unittest.TestCase):
    def test_upsert_parameterizes_title_and_preserves_omitted_titles(self):
        cursor = Mock()
        row = {**ENTRY, "entry_date": DAY}
        row.pop("date")
        cursor.fetchone.return_value = row

        @contextmanager
        def get_cursor():
            yield cursor

        for title in (None, "", "Title '); DROP TABLE diary_entry; --"):
            with self.subTest(title=title), patch.object(service, "get_db_cursor", get_cursor):
                entry = service.upsert_diary_entry("owner-id", DAY, "Body", None, title=title)
                query, params = cursor.execute.call_args.args
                self.assertEqual(params, ["owner-id", DAY, "Body", None, title, title])
                self.assertIn("COALESCE(%s, diary_entry.title)", query)
                self.assertNotIn("DROP TABLE", query)
                self.assertEqual(entry["title"], "My day")

    def test_correction_prompt_preserves_current_style_even_with_different_history(self):
        for text, register in (("昨日は図書館へ行った。", "plain"), ("昨日は図書館へ行きました。", "polite"), ("今日はめっちゃ楽しかった！", "plain")):
            with self.subTest(register=register), patch.object(correction_service, "fetch_recent_diary_entries", return_value=[{"date": "2026-10-26", "text": "拝見いたしました。"}]) as history, patch.object(correction_service, "generate_json_reply", return_value={"detected_register": register, "corrected": text, "notes": []}) as generate:
                result = correction_service.request_correction("owner-id", text, DAY)
                system = generate.call_args.kwargs["messages"][0]["content"]
                self.assertIn("Formal or polite writing must remain formal or polite", system)
                self.assertIn("Casual, conversational, or familiar writing must remain casual", system)
                self.assertIn("override the style of the current entry", system)
                self.assertIn("Preserve intentional register switches", system)
                self.assertNotIn("has chosen", system)
                self.assertEqual(result.corrected, text)
                history.assert_called_once_with("owner-id", DAY, limit=3)

    def test_invalid_ai_output_is_retried_and_timeout_is_not_hidden(self):
        with patch.object(correction_service, "generate_json_reply", side_effect=[{}, {"corrected": "今日は楽しかった。"}]) as generate:
            correction_service.request_correction("owner-id", "今日は楽しかった。", None)
            self.assertEqual(generate.call_count, 2)
        with patch.object(correction_service, "generate_json_reply", side_effect=TimeoutError("Timeout")):
            with self.assertRaises(TimeoutError):
                correction_service.request_correction("owner-id", "今日は楽しかった。", None)


if __name__ == "__main__":
    unittest.main()
