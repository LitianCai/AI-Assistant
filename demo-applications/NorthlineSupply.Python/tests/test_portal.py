"""Portal tests. httpx is mocked, so the distributor API process is not required."""

import httpx
import pytest
from fastapi.testclient import TestClient

ACCOUNT = {
    "accountName": "Apex Machining",
    "accountNumber": "A-1042",
    "buyerName": "Riley Chen",
    "creditHold": False,
}
ORDERS = {
    "orders": [
        {
            "orderNumber": 10482,
            "placedOn": "2026-10-21",
            "status": "Partially shipped",
            "shippedOn": "2026-10-28",
            "lineCount": 4,
            "openLineCount": 2,
        }
    ]
}
INVOICES = {
    "invoices": [
        {
            "invoiceNumber": "INV-8831",
            "orderNumber": 10482,
            "billedOn": "2026-10-28",
            "status": "Open",
            "total": 409.00,
            "balance": 409.00,
        }
    ]
}
ORDER = {
    "orderNumber": 10482,
    "placedOn": "2026-10-21",
    "status": "Partially shipped",
    "shippedOn": "2026-10-28",
    "lineCount": 4,
    "openLineCount": 2,
    "lines": [
        {
            "sku": "NL-4402",
            "name": "Brass ball valve",
            "quantity": 10,
            "status": "Shipped",
            "promiseDate": None,
            "unitPrice": 24.50,
            "available": 120,
            "allocated": 8,
        }
    ],
}


class _Response:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _Api:
    def __init__(self) -> None:
        self.posts: list[dict] = []
        self.gets: list[dict] = []
        self.client_kwargs: dict = {}
        self.get_error: Exception | None = None


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> _Api:
    stub = _Api()

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            stub.client_kwargs = kwargs

        def request(self, method, url, json=None, headers=None, **kwargs):
            if method == "POST":
                stub.posts.append({"url": url, "json": json, "headers": headers or {}})
                return _Response(
                    200,
                    {
                        "token": "session-token-abc",
                        "displayName": "Riley Chen",
                        "accountName": "Apex Machining",
                        "accountNumber": "A-1042",
                    },
                )
            stub.gets.append({"url": url, "headers": headers or {}})
            if stub.get_error is not None:
                raise stub.get_error
            if url == "/account":
                return _Response(200, ACCOUNT)
            if url == "/orders":
                return _Response(200, ORDERS)
            if url == "/invoices":
                return _Response(200, INVOICES)
            if url == "/orders/10482":
                return _Response(200, ORDER)
            return _Response(404, {"title": "Not found"})

        def close(self) -> None:
            return None

    monkeypatch.delenv("NORTHLINE_API_BASE", raising=False)
    monkeypatch.setattr("app.distributor.HttpClient", FakeClient)
    return stub


@pytest.fixture
def portal(api: _Api):
    from app.main import app

    with TestClient(app) as client:
        client.api = api
        yield client


def test_login_posts_only_user_name_and_sets_cookie(portal: TestClient) -> None:
    response = portal.post("/login", data={"userName": "riley.chen"}, follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"] == "/account"
    posted = portal.api.posts
    assert len(posted) == 1
    assert posted[0]["url"] == "/session"
    assert posted[0]["json"] == {"userName": "riley.chen"}
    assert list(posted[0]["json"]) == ["userName"]
    assert posted[0]["headers"] == {}
    header = response.headers["set-cookie"].lower()
    assert "northline_demo=session-token-abc" in header
    assert "httponly" in header
    assert "samesite=lax" in header
    assert "a-1042" not in header
    assert portal.api.client_kwargs["base_url"] == "http://localhost:5080"


def test_account_without_cookie_redirects_to_login(portal: TestClient) -> None:
    response = portal.get("/account", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/login"
    assert portal.api.gets == []


def _sign_in(portal: TestClient) -> None:
    portal.cookies.set("northline_demo", "session-token-abc")


def test_account_with_cookie_shows_company_order_and_widget(portal: TestClient) -> None:
    _sign_in(portal)
    response = portal.get("/account")

    assert response.status_code == 200
    html = response.text
    assert "Apex Machining" in html
    assert "10482" in html
    assert "This account can order." in html
    assert "Riley Chen" in html
    assert "Orders API" in html
    assert "Invoices API" in html
    assert 'name="accountId"' not in html
    assert "account-id" not in html.lower()
    assert "accountid" not in html.lower()
    assert 'token: "preview-demo-token"' in html
    assert 'apiBaseUrl: "preview"' in html
    assert "session-token-abc" not in html
    assert 'src="/assistant/ai-assistant.umd.js"' in html
    assert html.lower().count("<html") == 1
    assert 'lang="en"' in html
    assert "<title>Northline Supply</title>" in html
    assert [call["url"] for call in portal.api.gets] == ["/account", "/orders", "/invoices"]
    for call in portal.api.gets:
        assert call["headers"] == {"Authorization": "Bearer session-token-abc"}


def test_login_page_has_no_account_id_field(portal: TestClient) -> None:
    response = portal.get("/login")

    assert response.status_code == 200
    html = response.text
    assert 'name="userName"' in html
    assert 'placeholder="riley.chen"' in html
    assert "<label" in html
    assert "account-id" not in html.lower()
    assert "accountid" not in html.lower()
    assert "preview-demo-token" not in html
    assert "AiAssistant.mountAiAssistant" not in html


def test_order_page_renders_only_api_facts(portal: TestClient) -> None:
    _sign_in(portal)
    response = portal.get("/orders/10482")

    assert response.status_code == 200
    html = response.text
    assert "shipped on 28 Oct 2026" in html
    assert "2 of 4 lines are still open." in html
    assert "Partially shipped" in html
    assert "NL-4402" in html
    assert "$24.50" in html
    assert "Inventory API" in html
    assert 'apiBaseUrl: "preview"' in html
    assert 'token: "preview-demo-token"' in html
    assert portal.api.gets[-1]["url"] == "/orders/10482"
    assert portal.api.gets[-1]["headers"]["Authorization"] == "Bearer session-token-abc"


def test_order_page_without_cookie_redirects(portal: TestClient) -> None:
    response = portal.get("/orders/10482", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/login"


def test_api_down_shows_plain_error_without_invented_facts(portal: TestClient) -> None:
    portal.api.get_error = httpx.ConnectError("connection refused")
    _sign_in(portal)
    response = portal.get("/account")

    assert response.status_code == 502
    assert "The distributor API is unavailable." in response.text
    assert "Apex Machining" not in response.text
    assert "10482" not in response.text
    assert "28 Oct 2026" not in response.text


def test_widget_script_route_stays_in_place(portal: TestClient) -> None:
    response = portal.get("/assistant/ai-assistant.umd.js")

    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert "javascript" in response.headers["content-type"]
        assert len(response.content) > 100
