"""Anomaly auto-disable.

When a staff member (agent or human) accumulates too many ``error``/``warn``
events in a short window, flip their state to ``disabled`` and emit a
``system`` ledger entry so the admin sees why. Thresholds are env-tunable.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import psycopg2

from config import get_database_url

logger = logging.getLogger(__name__)

BAD_EVENT_THRESHOLD = int(os.environ.get("WORKFORCE_BAD_EVENT_THRESHOLD", "5"))
WINDOW_MINUTES = int(os.environ.get("WORKFORCE_ANOMALY_WINDOW_MIN", "10"))


def _conn():
    return psycopg2.connect(get_database_url())


def check_and_disable(staff_id: Optional[str]) -> Optional[str]:
    """Run an anomaly check for one staff_id.

    Returns the reason string if the staff member was just disabled, else None.
    Best-effort — DB failures degrade silently.
    """
    if not staff_id:
        return None
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT bad_events FROM staff_anomaly_window
                     WHERE staff_id = %s
                    """,
                    (staff_id,),
                )
                row = cur.fetchone()
                bad = int(row[0]) if row else 0
                if bad < BAD_EVENT_THRESHOLD:
                    return None

                # Only flip if not already disabled, to avoid log spam.
                cur.execute(
                    """
                    UPDATE staff
                       SET state = 'disabled', updated_at = now()
                     WHERE id = %s AND state <> 'disabled'
                     RETURNING short_name
                    """,
                    (staff_id,),
                )
                changed = cur.fetchone()
                if not changed:
                    return None
                short_name = changed[0]
                reason = (
                    f"auto-disabled: {bad} bad events in last {WINDOW_MINUTES}m "
                    f"(threshold {BAD_EVENT_THRESHOLD})"
                )
                cur.execute(
                    """
                    INSERT INTO staff_activity (staff_id, source, summary, status)
                    VALUES (%s, 'system', %s, 'error')
                    """,
                    (staff_id, reason),
                )
                logger.warning("Auto-disabled staff %s: %s", short_name, reason)
                return reason
    except Exception as exc:
        logger.warning("anomaly check failed: %s", exc)
        return None
