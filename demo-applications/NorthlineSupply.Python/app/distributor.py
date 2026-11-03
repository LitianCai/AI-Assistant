"""Server-side calls to the Northline distributor API.

The browser never calls that API. The only credential sent is the bearer token
from the signed-in session. Tenant, company, and account ids are not sent.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import httpx
from httpx import Client as HttpClient

# [ASSUMED] Distributor calls time out after 5 seconds. Three consecutive
# transport or server failures open the circuit for 30 seconds.
_TIMEOUT_SECONDS = 5.0
_FAILURES_TO_OPEN = 3
_OPEN_SECONDS = 30.0

UNAVAILABLE = "The distributor API is unavailable."


class DistributorError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DistributorClient:
    def __init__(self, base_url: str) -> None:
        self._http = HttpClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(_TIMEOUT_SECONDS),
            follow_redirects=False,
        )
        self._lock = threading.Lock()
        self._failures = 0
        self._open_until = 0.0

    def close(self) -> None:
        self._http.close()

    def create_session(self, user_name: str) -> str:
        response = self._request("POST", "/session", json_body={"userName": user_name})
        if response.status_code != 200:
            raise DistributorError(_title(response, "Sign in failed."), response.status_code)
        payload = _json_object(response)
        token = payload.get("token")
        if not isinstance(token, str) or not token:
            raise DistributorError("Sign in failed.")
        return token

    def get_account(self, token: str) -> dict[str, Any]:
        return self._get_object("/account", token)

    def get_orders(self, token: str) -> dict[str, Any]:
        return self._get_object("/orders", token)

    def get_order(self, token: str, order_number: str) -> dict[str, Any]:
        return self._get_object(f"/orders/{order_number}", token)

    def get_invoices(self, token: str) -> dict[str, Any]:
        return self._get_object("/invoices", token)

    def _get_object(self, path: str, token: str) -> dict[str, Any]:
        response = self._request(
            "GET",
            path,
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            raise DistributorError("Sign in required.", 401)
        if response.status_code == 404:
            raise DistributorError("That order is unavailable.", 404)
        if response.status_code != 200:
            raise DistributorError(UNAVAILABLE, response.status_code)
        return _json_object(response)

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        self._ensure_closed_circuit()
        try:
            response = self._http.request(method, path, json=json_body, headers=headers)
        except httpx.TimeoutException as exc:
            self._record_failure()
            raise DistributorError(UNAVAILABLE) from exc
        except httpx.HTTPError as exc:
            self._record_failure()
            raise DistributorError(UNAVAILABLE) from exc
        if response.status_code >= 500:
            self._record_failure()
        else:
            self._record_success()
        return response

    def _ensure_closed_circuit(self) -> None:
        with self._lock:
            if time.monotonic() < self._open_until:
                raise DistributorError(UNAVAILABLE)

    def _record_success(self) -> None:
        with self._lock:
            self._failures = 0

    def _record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= _FAILURES_TO_OPEN:
                self._open_until = time.monotonic() + _OPEN_SECONDS
                self._failures = 0


def _json_object(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise DistributorError(UNAVAILABLE) from exc
    if not isinstance(payload, dict):
        raise DistributorError(UNAVAILABLE)
    return payload


def _title(response: httpx.Response, fallback: str) -> str:
    try:
        payload = response.json()
    except ValueError:
        return fallback
    if isinstance(payload, dict) and isinstance(payload.get("title"), str) and payload["title"]:
        return payload["title"]
    return fallback
