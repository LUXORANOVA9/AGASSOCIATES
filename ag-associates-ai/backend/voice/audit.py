"""Append-only audit log for the voice command system.

Writes are best-effort: an audit failure must never block the user-facing
request. All sensitive payloads stay inside Postgres — only command IDs are
ever returned over the wire.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import psycopg2

from config import get_database_url

logger = logging.getLogger(__name__)


def _conn():
    return psycopg2.connect(get_database_url())


def log_command(
    *,
    user_id: Optional[str],
    transcript: str,
    detected_language: Optional[str],
    decision: Dict[str, Any],
    risk: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    audio_s3_key: Optional[str] = None,
) -> str:
    """Insert a voice command record. Returns the new command_id (or a synthetic
    one if the DB write failed, so callers always have a stable handle)."""
    command_id = str(uuid.uuid4())
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO voice_command_logs
                        (id, user_id, transcript, detected_language, tool_name,
                         tool_args, risk, status, result, audio_s3_key, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        command_id,
                        user_id,
                        transcript,
                        detected_language,
                        decision.get("tool"),
                        json.dumps(decision.get("args") or {}),
                        risk,
                        status,
                        json.dumps(result or {}),
                        audio_s3_key,
                        datetime.utcnow(),
                    ),
                )
    except Exception as exc:
        logger.warning("voice audit insert failed (continuing): %s", exc)
    return command_id


def mark_confirmed(command_id: str, result: Dict[str, Any]) -> None:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE voice_command_logs
                       SET status = 'executed',
                           result = %s,
                           confirmed_at = %s
                     WHERE id = %s
                    """,
                    (json.dumps(result or {}), datetime.utcnow(), command_id),
                )
    except Exception as exc:
        logger.warning("voice audit confirm-update failed: %s", exc)


def get_pending(command_id: str) -> Optional[Dict[str, Any]]:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, tool_name, tool_args, risk, status, created_at
                      FROM voice_command_logs
                     WHERE id = %s
                    """,
                    (command_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "user_id": row[1],
                    "tool_name": row[2],
                    "tool_args": row[3] or {},
                    "risk": row[4],
                    "status": row[5],
                    "created_at": row[6],
                }
    except Exception as exc:
        logger.warning("voice audit lookup failed: %s", exc)
        return None


def get_latest_pending_for_user(user_id: str, max_age_seconds: int = 30) -> Optional[Dict[str, Any]]:
    """Return the most recent ``pending_confirm`` command for ``user_id`` that
    was created within ``max_age_seconds``. Used by the WhatsApp YES/NO loop
    where the caller doesn't quote the command_id back."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, tool_name, tool_args, risk, status, created_at
                      FROM voice_command_logs
                     WHERE user_id = %s
                       AND status = 'pending_confirm'
                       AND created_at > now() - (%s || ' seconds')::interval
                     ORDER BY created_at DESC
                     LIMIT 1
                    """,
                    (user_id, str(max_age_seconds)),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "user_id": row[1],
                    "tool_name": row[2],
                    "tool_args": row[3] or {},
                    "risk": row[4],
                    "status": row[5],
                    "created_at": row[6],
                }
    except Exception as exc:
        logger.warning("voice audit latest-pending lookup failed: %s", exc)
        return None


def mark_denied(command_id: str, reason: str) -> None:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE voice_command_logs
                       SET status = 'denied',
                           result = %s
                     WHERE id = %s
                    """,
                    (json.dumps({"reason": reason}), command_id),
                )
    except Exception as exc:
        logger.warning("voice audit deny-update failed: %s", exc)
