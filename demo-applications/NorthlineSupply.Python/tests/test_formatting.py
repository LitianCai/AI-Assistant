from app.formatting import format_date, format_money


def test_format_date_uses_english_month() -> None:
    assert format_date("2026-10-28") == "28 Oct 2026"
    assert format_date(None) == ""
    assert format_date("") == ""


def test_format_money_is_usd_with_two_decimals() -> None:
    assert format_money(24.5) == "$24.50"
    assert format_money(409) == "$409.00"
    assert format_money(None) == ""
