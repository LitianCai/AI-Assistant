"""Display formatting for API values. Missing values stay blank."""

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

_MONTHS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)


def format_date(value: object) -> str:
    """Format an ISO date as `28 Oct 2026`. Leave a missing value blank."""
    if value is None or value == "":
        return ""
    text = str(value)
    try:
        day = date.fromisoformat(text[:10])
    except ValueError:
        return text
    return f"{day.day} {_MONTHS[day.month - 1]} {day.year}"


def format_money(value: object) -> str:
    """[ASSUMED] USD, shown with a dollar sign and two decimals."""
    if value is None or value == "":
        return ""
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        return str(value)
    quantized = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"${quantized:,.2f}"
