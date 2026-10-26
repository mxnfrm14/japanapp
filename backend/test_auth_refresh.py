"""Refresh endpoint contract without contacting Supabase or PostgreSQL."""

import os
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

with patch.dict(os.environ, {
    "SUPABASE_URL": "https://example.invalid",
    "SUPABASE_KEY": "test",
    "SUPABASE_SERVICE_KEY": "test",
    "DATABASE_URL": "postgresql://localhost/japanapp_test",
    "JWT_SECRET": "test",
    "DEBUG": "false",
}):
    from app.routes.auth import router


class RefreshSessionTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)
        patcher = patch("app.services.auth.supabase_auth_request")
        self.request = patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.client.close)

    def test_refresh_requires_no_valid_access_token_and_returns_rotated_tokens(self):
        session = {
            "access_token": "new-access",
            "refresh_token": "new-refresh",
            "expires_in": 3600,
            "user": {"id": "test-user"},
        }
        self.request.return_value = Mock(status_code=200, json=lambda: session)
        response = self.client.post("/auth/refresh", json={"refresh_token": "old-refresh"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"session": session, "user": session["user"]})
        self.request.assert_called_once_with(
            "POST", "/auth/v1/token?grant_type=refresh_token",
            payload={"refresh_token": "old-refresh"},
        )

    def test_invalid_or_expired_refresh_tokens_return_401(self):
        for upstream_status in (400, 401, 403):
            with self.subTest(upstream_status=upstream_status):
                self.request.return_value = Mock(status_code=upstream_status)
                response = self.client.post("/auth/refresh", json={"refresh_token": "invalid"})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {"detail": "Session expired. Please sign in again."})

    def test_upstream_outage_does_not_leak_provider_errors(self):
        self.request.return_value = Mock(status_code=500)
        response = self.client.post("/auth/refresh", json={"refresh_token": "refresh"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Session renewal unavailable"})

    def test_network_failure_returns_503(self):
        self.request.side_effect = httpx.ConnectError("private connection details")
        response = self.client.post("/auth/refresh", json={"refresh_token": "refresh"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Session renewal unavailable"})

    def test_missing_empty_or_non_string_refresh_tokens_are_rejected(self):
        for body in ({}, {"refresh_token": ""}, {"refresh_token": None}, {"refresh_token": 42}):
            with self.subTest(body=body):
                self.assertEqual(self.client.post("/auth/refresh", json=body).status_code, 422)
        self.request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
