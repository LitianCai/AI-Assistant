"""Thin server-rendered portal for Northline Supply."""

from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.distributor import UNAVAILABLE, DistributorClient, DistributorError
from app.formatting import format_date, format_money

COOKIE_NAME = "northline_demo"
DEFAULT_API_BASE = "http://localhost:5080"
_ORDER_NUMBER = re.compile(r"^[0-9]+$")

_TEMPLATES = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def find_widget_script() -> Path | None:
    """Walk up until a widget directory exists, then read its built UMD file."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        widget_dir = parent / "widget"
        if widget_dir.is_dir():
            candidate = widget_dir / "dist" / "lib" / "ai-assistant.umd.js"
            return candidate if candidate.is_file() else None
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    base_url = os.environ.get("NORTHLINE_API_BASE", DEFAULT_API_BASE)
    client = DistributorClient(base_url)
    app.state.distributor = client
    try:
        yield
    finally:
        client.close()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)

    @app.get("/login", response_model=None)
    def login_page(request: Request) -> HTMLResponse:
        return _page(request, "login.html", {"error": ""})

    @app.post("/login", response_model=None)
    async def login_submit(request: Request) -> HTMLResponse | RedirectResponse:
        form = await request.form()
        user_name = str(form.get("userName") or "").strip()
        if not user_name:
            return _page(request, "login.html", {"error": "Enter a user name."}, status_code=400)
        try:
            token = request.app.state.distributor.create_session(user_name)
        except DistributorError as exc:
            status = 401 if exc.status_code == 401 else 502
            return _page(request, "login.html", {"error": exc.message}, status_code=status)
        response = RedirectResponse(url="/account", status_code=303)
        # [ASSUMED] After login, the distributor API token is stored in the
        # httpOnly SameSite=Lax cookie northline_demo for the browser session.
        # The cookie value is that token, not a tenant id.
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            httponly=True,
            samesite="lax",
            path="/",
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/account", response_model=None)
    def account_page(request: Request) -> HTMLResponse | RedirectResponse:
        token = _token(request)
        if token is None:
            return _login_redirect()
        distributor: DistributorClient = request.app.state.distributor
        try:
            account = distributor.get_account(token)
            orders_payload = distributor.get_orders(token)
            invoices_payload = distributor.get_invoices(token)
            orders = _require_list(orders_payload, "orders")
            invoices = _require_list(invoices_payload, "invoices")
        except DistributorError as exc:
            return _api_error(request, exc, show_widget=True)
        return _page(
            request,
            "account.html",
            {
                "account": _account_view(account),
                "orders": [_order_summary(item) for item in orders if isinstance(item, dict)],
                "invoices": [_invoice_view(item) for item in invoices if isinstance(item, dict)],
                "show_widget": True,
            },
        )

    @app.get("/orders/{order_number}", response_model=None)
    def order_page(request: Request, order_number: str) -> HTMLResponse | RedirectResponse:
        token = _token(request)
        if token is None:
            return _login_redirect()
        if _ORDER_NUMBER.fullmatch(order_number) is None:
            return _page(
                request,
                "error.html",
                {"message": "That order is unavailable.", "show_widget": True},
                status_code=404,
            )
        try:
            order = request.app.state.distributor.get_order(token, order_number)
            lines = order.get("lines")
            if not isinstance(lines, list):
                raise DistributorError(UNAVAILABLE)
        except DistributorError as exc:
            return _api_error(request, exc, show_widget=True)
        return _page(
            request,
            "order.html",
            {"order": _order_detail(order, lines), "show_widget": True},
        )

    @app.get("/assistant/ai-assistant.umd.js", response_model=None)
    def assistant_script() -> FileResponse | HTMLResponse:
        # The route stays in place when the built file is missing. Do not build the widget here.
        script = find_widget_script()
        if script is None:
            return HTMLResponse("The assistant script is not available.", status_code=404)
        return FileResponse(script, media_type="text/javascript")

    return app


app = create_app()


def _token(request: Request) -> str | None:
    value = request.cookies.get(COOKIE_NAME)
    if not isinstance(value, str) or not value:
        return None
    return value


def _login_redirect() -> RedirectResponse:
    response = RedirectResponse(url="/login", status_code=302)
    response.headers["Cache-Control"] = "no-store"
    return response


def _api_error(
    request: Request,
    exc: DistributorError,
    *,
    show_widget: bool = False,
) -> HTMLResponse | RedirectResponse:
    if exc.status_code == 401:
        response = _login_redirect()
        response.delete_cookie(COOKIE_NAME, path="/")
        return response
    status = 404 if exc.status_code == 404 else 502
    return _page(
        request,
        "error.html",
        {"message": exc.message, "show_widget": show_widget},
        status_code=status,
    )


def _page(request: Request, name: str, context: dict[str, Any], status_code: int = 200) -> HTMLResponse:
    response = _TEMPLATES.TemplateResponse(request, name, context, status_code=status_code)
    response.headers["Cache-Control"] = "no-store"
    return response


def _require_list(payload: dict[str, Any], key: str) -> list[Any]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise DistributorError(UNAVAILABLE)
    return value


def _text(value: object) -> str:
    if value is None:
        return ""
    return str(value)


def _account_view(account: dict[str, Any]) -> dict[str, Any]:
    return {
        "buyerName": _text(account.get("buyerName")),
        "accountName": _text(account.get("accountName")),
        "accountNumber": _text(account.get("accountNumber")),
        "canOrder": account.get("creditHold") is False,
    }


def _order_link(order_number: object) -> str:
    text = _text(order_number)
    if _ORDER_NUMBER.fullmatch(text) is None:
        return ""
    return f"/orders/{text}"


def _order_summary(order: dict[str, Any]) -> dict[str, str]:
    number = _text(order.get("orderNumber"))
    return {
        "orderNumber": number,
        "href": _order_link(order.get("orderNumber")),
        "placedOn": format_date(order.get("placedOn")),
        "status": _text(order.get("status")),
        "shippedOn": format_date(order.get("shippedOn")),
        "lineCount": _text(order.get("lineCount")),
        "openLineCount": _text(order.get("openLineCount")),
    }


def _invoice_view(invoice: dict[str, Any]) -> dict[str, str]:
    return {
        "invoiceNumber": _text(invoice.get("invoiceNumber")),
        "orderNumber": _text(invoice.get("orderNumber")),
        "orderHref": _order_link(invoice.get("orderNumber")),
        "billedOn": format_date(invoice.get("billedOn")),
        "status": _text(invoice.get("status")),
        "total": format_money(invoice.get("total")),
        "balance": format_money(invoice.get("balance")),
    }


def _whole_number(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if isinstance(value, float) and not value.is_integer():
        return None
    return int(value)


def _order_detail(order: dict[str, Any], lines: list[Any]) -> dict[str, Any]:
    line_count = _whole_number(order.get("lineCount"))
    open_line_count = _whole_number(order.get("openLineCount"))
    shipped = format_date(order.get("shippedOn"))
    number = _text(order.get("orderNumber"))
    return {
        "orderNumber": number,
        "status": _text(order.get("status")),
        "shippedOn": shipped,
        "shippedSentence": f"Order {number} shipped on {shipped}." if shipped else "",
        "lineCount": "" if line_count is None else str(line_count),
        "openLineCount": "" if open_line_count is None else str(open_line_count),
        "openSentence": (
            f"{open_line_count} of {line_count} lines are still open."
            if line_count is not None and open_line_count is not None
            else ""
        ),
        "lines": [_line_view(item) for item in lines if isinstance(item, dict)],
    }


def _line_view(line: dict[str, Any]) -> dict[str, str]:
    return {
        "sku": _text(line.get("sku")),
        "name": _text(line.get("name")),
        "quantity": _text(line.get("quantity")),
        "status": _text(line.get("status")),
        "promiseDate": format_date(line.get("promiseDate")),
        "unitPrice": format_money(line.get("unitPrice")),
        "available": _text(line.get("available")),
        "allocated": _text(line.get("allocated")),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=5081)
