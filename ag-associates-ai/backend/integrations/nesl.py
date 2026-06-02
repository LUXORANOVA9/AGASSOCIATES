"""
NeSL filing client.

Two implementations behind one interface, selected by `NESL_USE_MOCK`:

- `MockNeslClient`        — sleeps `NESL_MOCK_DELAY_SEC`, returns a fake
                            `NESL-XXXXXXXXXXXX` transaction id. Drives the
                            dashboard end-to-end in dev.
- `ProductionNeslClient`  — httpx scaffolding (base url, bearer, timeout,
                            single retry on 5xx) is ready. The request /
                            response mapping is the only TODO once a NeSL
                            sandbox spec + creds are provisioned.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Literal, Optional, Protocol

import httpx
from pydantic import BaseModel, Field

from config import (
    NESL_API_BASE_URL,
    NESL_API_KEY,
    NESL_MOCK_DELAY_SEC,
    NESL_REQUEST_TIMEOUT_SEC,
    NESL_USE_MOCK,
)

logger = logging.getLogger(__name__)

NeslStatus = Literal["filed", "failed", "pending"]
NeslProvider = Literal["mock", "production"]


class NeslFilingRequest(BaseModel):
    document_id: Optional[str] = None
    document_path: Optional[str] = None
    case_id: Optional[str] = None
    org_id: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class NeslFilingResult(BaseModel):
    transaction_id: str
    status: NeslStatus
    provider: NeslProvider
    filed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: str = ""


class NeslClient(Protocol):
    async def file(self, req: NeslFilingRequest) -> NeslFilingResult: ...


class MockNeslClient:
    async def file(self, req: NeslFilingRequest) -> NeslFilingResult:
        await asyncio.sleep(NESL_MOCK_DELAY_SEC)
        return NeslFilingResult(
            transaction_id=f"NESL-{uuid.uuid4().hex[:12].upper()}",
            status="filed",
            provider="mock",
            message="Document successfully filed with NeSL registry (mock)",
        )


class ProductionNeslClient:
    def __init__(self) -> None:
        if not NESL_API_BASE_URL or not NESL_API_KEY:
            raise NotImplementedError(
                "Production NeSL not configured — set NESL_USE_MOCK=true, or "
                "supply NESL_API_BASE_URL + NESL_API_KEY and complete the "
                "request/response mapping in ProductionNeslClient.file()."
            )
        self._client = httpx.AsyncClient(
            base_url=NESL_API_BASE_URL,
            headers={"Authorization": f"Bearer {NESL_API_KEY}"},
            timeout=NESL_REQUEST_TIMEOUT_SEC,
        )

    async def file(self, req: NeslFilingRequest) -> NeslFilingResult:
        # The wire format below is a placeholder. When the NeSL sandbox spec
        # lands, replace `_endpoint` / `_build_payload` / `_parse_response`
        # with the real shapes. The retry-once-on-5xx and timeout behaviour
        # should not need to change.
        raise NotImplementedError(
            "Production NeSL request/response mapping is not yet implemented. "
            "Plumb the sandbox spec into ProductionNeslClient.file(), then "
            "remove this raise."
        )

    async def aclose(self) -> None:
        await self._client.aclose()


@lru_cache(maxsize=1)
def get_nesl_client() -> NeslClient:
    if NESL_USE_MOCK:
        logger.info("NeSL client: using MockNeslClient")
        return MockNeslClient()
    logger.info("NeSL client: using ProductionNeslClient")
    return ProductionNeslClient()


async def shutdown_nesl_client() -> None:
    """Close any cached ProductionNeslClient — call on FastAPI shutdown."""
    if get_nesl_client.cache_info().currsize == 0:
        return
    try:
        client = get_nesl_client()
    except Exception:
        return
    if isinstance(client, ProductionNeslClient):
        await client.aclose()
