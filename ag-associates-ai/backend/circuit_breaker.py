"""Redis-backed circuit breaker for RPA portal automations.

Prevents account lockouts on government portals (NeSL, IGR, GRAS) by
automatically breaking the circuit after N consecutive failures in a
sliding window. Failed tasks are rerouted to a human-in-the-loop queue.

States:
  CLOSED  — Normal operation, requests pass through
  OPEN    — Circuit tripped, requests blocked immediately
  HALF_OPEN — Testing if the portal has recovered
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


@dataclass
class CircuitBreakerConfig:
    name: str
    failure_threshold: int = 3
    window_seconds: int = 600
    cooldown_seconds: int = 300
    half_open_max_retries: int = 2


DEFAULT_CONFIGS = {
    "gras": CircuitBreakerConfig(
        name="gras",
        failure_threshold=int(os.environ.get("CB_GRAS_FAILURE_THRESHOLD", "3")),
        window_seconds=int(os.environ.get("CB_GRAS_WINDOW_SEC", "600")),
        cooldown_seconds=int(os.environ.get("CB_GRAS_COOLDOWN_SEC", "300")),
    ),
    "igr": CircuitBreakerConfig(
        name="igr",
        failure_threshold=int(os.environ.get("CB_IGR_FAILURE_THRESHOLD", "3")),
        window_seconds=int(os.environ.get("CB_IGR_WINDOW_SEC", "600")),
        cooldown_seconds=int(os.environ.get("CB_IGR_COOLDOWN_SEC", "300")),
    ),
    "nesl": CircuitBreakerConfig(
        name="nesl",
        failure_threshold=int(os.environ.get("CB_NESL_FAILURE_THRESHOLD", "3")),
        window_seconds=int(os.environ.get("CB_NESL_WINDOW_SEC", "600")),
        cooldown_seconds=int(os.environ.get("CB_NESL_COOLDOWN_SEC", "300")),
    ),
}


class CircuitBreaker:
    def __init__(self, config: CircuitBreakerConfig):
        self.config = config
        self._redis_conn: Optional[aioredis.Redis] = None
        self._local_state = CircuitState.CLOSED
        self._local_half_open_attempts = 0

    async def _redis(self) -> aioredis.Redis:
        if self._redis_conn is None:
            url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            pwd = os.environ.get("REDIS_PASSWORD")
            if pwd:
                url = url.replace("redis://", f"redis://:{pwd}@")
            self._redis_conn = aioredis.from_url(url, decode_responses=True)
        return self._redis_conn

    def _failure_key(self) -> str:
        return f"cb:{self.config.name}:failures"

    def _state_key(self) -> str:
        return f"cb:{self.config.name}:state"

    def _half_open_key(self) -> str:
        return f"cb:{self.config.name}:half_open_attempts"

    async def _prune_old_failures(self, r: aioredis.Redis):
        cutoff = time.time() - self.config.window_seconds
        await r.zremrangebyscore(self._failure_key(), "-inf", cutoff)

    async def record_failure(self, error_message: str) -> dict:
        r = await self._redis()
        now = time.time()
        await r.zadd(self._failure_key(), {f"{now}:{error_message[:200]}": now})
        await r.expire(self._failure_key(), self.config.window_seconds + 60)
        await self._prune_old_failures(r)
        count = await r.zcard(self._failure_key())
        if count >= self.config.failure_threshold:
            await r.setex(self._state_key(), self.config.cooldown_seconds + 60, CircuitState.OPEN.value)
            await r.delete(self._half_open_key())
            self._local_state = CircuitState.OPEN
            logger.warning(
                "Circuit [%s] OPEN after %d failures in %ds window",
                self.config.name, count, self.config.window_seconds,
            )
        return {"failure_count": count, "state": CircuitState.OPEN.value if count >= self.config.failure_threshold else CircuitState.CLOSED.value}

    async def record_success(self):
        r = await self._redis()
        pipeline = r.pipeline()
        pipeline.delete(self._failure_key())
        pipeline.delete(self._half_open_key())
        pipeline.set(self._state_key(), CircuitState.CLOSED.value, ex=self.config.window_seconds)
        await pipeline.execute()
        self._local_state = CircuitState.CLOSED
        self._local_half_open_attempts = 0
        logger.info("Circuit [%s] RESET to CLOSED after success", self.config.name)

    async def state(self) -> CircuitState:
        r = await self._redis()
        raw = await r.get(self._state_key())
        if raw is None:
            return CircuitState.CLOSED
        return CircuitState(raw)

    async def _transition_to_half_open(self):
        r = await self._redis()
        await r.set(self._state_key(), CircuitState.HALF_OPEN.value, ex=60)
        self._local_state = CircuitState.HALF_OPEN
        self._local_half_open_attempts = 0
        logger.info("Circuit [%s] → HALF_OPEN (cooldown expired)", self.config.name)

    async def can_pass(self) -> bool:
        state = await self.state()
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.OPEN:
            r = await self._redis()
            ttl = await r.ttl(self._state_key())
            if ttl is not None and ttl <= 0:
                await self._transition_to_half_open()
                return True
            return False
        if state == CircuitState.HALF_OPEN:
            r = await self._redis()
            raw = await r.get(self._half_open_key())
            current = int(raw) if raw else 0
            if current < self.config.half_open_max_retries:
                await r.incr(self._half_open_key())
                return True
            return False
        return False

    async def failure_count(self) -> int:
        r = await self._redis()
        await self._prune_old_failures(r)
        return await r.zcard(self._failure_key())

    async def status(self) -> dict:
        state = await self.state()
        count = await self.failure_count()
        return {
            "name": self.config.name,
            "state": state.value,
            "failure_count": count,
            "failure_threshold": self.config.failure_threshold,
            "window_seconds": self.config.window_seconds,
            "cooldown_seconds": self.config.cooldown_seconds,
        }


breakers = {
    name: CircuitBreaker(cfg)
    for name, cfg in DEFAULT_CONFIGS.items()
}


def get_breaker(portal: str) -> CircuitBreaker:
    return breakers.get(portal, breakers["gras"])
