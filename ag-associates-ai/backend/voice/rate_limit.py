"""Sliding-window rate limiter backed by Redis.

Bucket key shape: ``rl:{scope}:{capability}:{user_id}``. Each call lands a
timestamp in a Redis sorted set; we trim entries older than the window and
count what's left. Fails open (allows the call) when Redis is unreachable so
a cache outage never freezes the platform — anomaly auto-disable is the
backstop for that case.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

try:
    import redis  # type: ignore
except ImportError:  # pragma: no cover
    redis = None  # type: ignore

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
_CLIENT: Optional["redis.Redis"] = None
WINDOW_SECONDS = 3600  # one hour


def _client():
    global _CLIENT
    if redis is None:
        return None
    if _CLIENT is None:
        try:
            _CLIENT = redis.from_url(REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        except Exception as exc:
            logger.warning("redis init failed: %s", exc)
            _CLIENT = None
    return _CLIENT


def check_and_consume(scope: str, capability: str, user_id: str, limit: Optional[int]) -> dict:
    """Consume one slot. Returns {allowed, remaining, limit, reason}."""
    if not limit or limit <= 0:
        return {"allowed": True, "remaining": -1, "limit": limit, "reason": "no limit configured"}
    client = _client()
    if client is None:
        return {"allowed": True, "remaining": -1, "limit": limit, "reason": "redis unavailable — fail-open"}

    now_ms = int(time.time() * 1000)
    window_start = now_ms - WINDOW_SECONDS * 1000
    key = f"rl:{scope}:{capability}:{user_id}"

    try:
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now_ms): now_ms})
        pipe.zcard(key)
        pipe.expire(key, WINDOW_SECONDS + 60)
        _, _, count, _ = pipe.execute()
    except Exception as exc:
        logger.warning("rate-limit pipeline failed (fail-open): %s", exc)
        return {"allowed": True, "remaining": -1, "limit": limit, "reason": "redis error"}

    if count > limit:
        # Roll the just-added timestamp back so the user isn't double-penalised.
        try:
            client.zrem(key, str(now_ms))
        except Exception:
            pass
        return {"allowed": False, "remaining": 0, "limit": limit,
                "reason": f"rate limit exceeded: {count - 1}/{limit} per hour"}

    return {"allowed": True, "remaining": max(0, limit - count), "limit": limit, "reason": "ok"}


def get_limit_for_capability(capability_code: str) -> Optional[int]:
    """Read the per-hour limit from Postgres. Cached for 30 s."""
    import psycopg2
    from config import get_database_url
    cached = _LIMIT_CACHE.get(capability_code)
    now = time.time()
    if cached and (now - cached[0]) < 30:
        return cached[1]
    try:
        with psycopg2.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT per_hour_limit FROM capability WHERE code = %s", (capability_code,))
                row = cur.fetchone()
                value = row[0] if row else None
    except Exception as exc:
        logger.warning("limit lookup failed: %s", exc)
        return None
    _LIMIT_CACHE[capability_code] = (now, value)
    return value


_LIMIT_CACHE: dict = {}
