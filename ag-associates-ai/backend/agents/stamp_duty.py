"""Shared stamp duty validation — used by both LangGraph rental pipeline and NOI pipeline."""

import re
from typing import Optional

_NUMERIC_CLEAN_RE = re.compile(r'[^\d.]')
_DURATION_TOKENS_RE = re.compile(r'(\d+(?:\.\d+)?)\s*([a-zA-Z]*)')
_DURATION_NUMS_RE = re.compile(r'(\d+(?:\.\d+)?)')


def extract_numeric(val) -> Optional[float]:
    if val is None:
        return None
    try:
        cleaned = _NUMERIC_CLEAN_RE.sub('', str(val))
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def duration_to_months(duration_str: str) -> int:
    if not duration_str:
        return 0
    tokens = _DURATION_TOKENS_RE.findall(duration_str.lower())
    if tokens:
        total = 0.0
        for val_str, unit in tokens:
            val = float(val_str)
            if 'year' in unit or 'yr' in unit:
                total += val * 12
            else:
                total += val
        return int(round(total))
    nums = _DURATION_NUMS_RE.findall(duration_str)
    if not nums:
        return 0
    val = float(nums[0])
    if any(u in duration_str.lower() for u in ['year', 'yr']):
        return int(round(val * 12))
    return int(round(val))


def validate_stamp_duty(
    loan_amount: str,
    stamp_duty_paid: Optional[str] = None,
    tolerance: float = 50.0,
) -> dict:
    loan = extract_numeric(loan_amount)
    if loan is None:
        return {"passed": False, "expected": 0, "actual": 0, "feedback": "Invalid loan amount"}

    expected = loan * 0.003

    if stamp_duty_paid:
        actual = extract_numeric(stamp_duty_paid) or 0
        passed = abs(actual - expected) <= tolerance
        return {
            "passed": passed,
            "expected": round(expected, 2),
            "actual": actual,
            "loan_amount": loan,
            "feedback": (
                f"{'PASSED' if passed else 'FAILED'}: expected ~₹{expected:.2f} (0.3% of ₹{loan:,.0f}), "
                f"{'declared ₹' + str(actual) if stamp_duty_paid else 'no declared value'}"
            ),
        }

    return {
        "passed": True,
        "expected": round(expected, 2),
        "actual": None,
        "loan_amount": loan,
        "feedback": f"Expected stamp duty: ₹{expected:.2f} (0.3% of ₹{loan:,.0f})",
    }
