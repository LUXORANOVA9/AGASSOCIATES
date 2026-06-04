"""SessionManager — owns a pool of live Playwright Chromium contexts.

Each session has:
  • a `page` you can `goto`/`click`/`fill`
  • a periodic JPEG screenshot the UI polls
  • an idle TTL after which the session is auto-closed

Designed so a single FastAPI worker owns the manager. Don't share across
workers — each uvicorn worker gets its own pool, which is fine because the
admin UI binds to one session_id per window.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

logger = logging.getLogger(__name__)

IDLE_TTL_SECONDS = 600  # close a session after 10 minutes of inactivity
DEFAULT_VIEWPORT = {"width": 1280, "height": 800}


@dataclass
class Session:
    id: str
    label: str
    context: BrowserContext
    page: Page
    created_at: float = field(default_factory=time.time)
    last_used_at: float = field(default_factory=time.time)
    history: List[Dict[str, Any]] = field(default_factory=list)
    owner: Optional[str] = None  # email of the admin that spawned it

    def touch(self) -> None:
        self.last_used_at = time.time()


class SessionManager:
    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._sessions: Dict[str, Session] = {}
        self._lock = asyncio.Lock()
        self._reaper_task: Optional[asyncio.Task] = None

    async def _ensure_browser(self) -> Browser:
        if self._browser and self._browser.is_connected():
            return self._browser
        if self._playwright is None:
            self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )
        if self._reaper_task is None or self._reaper_task.done():
            self._reaper_task = asyncio.create_task(self._reap_idle())
        return self._browser

    async def _reap_idle(self) -> None:
        while True:
            try:
                await asyncio.sleep(60)
                cutoff = time.time() - IDLE_TTL_SECONDS
                async with self._lock:
                    stale = [sid for sid, s in self._sessions.items() if s.last_used_at < cutoff]
                for sid in stale:
                    logger.info("reaping idle session %s", sid)
                    await self.close(sid)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.warning("reaper loop error: %s", exc)

    async def create(self, label: str = "tab", owner: Optional[str] = None,
                     start_url: Optional[str] = None) -> Session:
        browser = await self._ensure_browser()
        context = await browser.new_context(viewport=DEFAULT_VIEWPORT)
        page = await context.new_page()
        sid = str(uuid.uuid4())
        session = Session(id=sid, label=label, context=context, page=page, owner=owner)
        async with self._lock:
            self._sessions[sid] = session
        if start_url:
            try:
                await page.goto(start_url, timeout=20000)
                session.history.append({"ts": time.time(), "action": "goto", "url": start_url})
            except Exception as exc:
                logger.warning("initial goto failed: %s", exc)
                session.history.append({"ts": time.time(), "action": "goto", "url": start_url, "error": str(exc)})
        return session

    async def list(self) -> List[Dict[str, Any]]:
        out = []
        async with self._lock:
            for s in self._sessions.values():
                try:
                    url = s.page.url
                    title = await s.page.title()
                except Exception:
                    url, title = "about:blank", ""
                out.append({
                    "id": s.id, "label": s.label, "owner": s.owner,
                    "url": url, "title": title,
                    "created_at": s.created_at, "last_used_at": s.last_used_at,
                })
        return out

    async def get(self, sid: str) -> Session:
        async with self._lock:
            session = self._sessions.get(sid)
        if not session:
            raise KeyError(sid)
        session.touch()
        return session

    async def close(self, sid: str) -> None:
        async with self._lock:
            session = self._sessions.pop(sid, None)
        if not session:
            return
        try:
            await session.context.close()
        except Exception as exc:
            logger.warning("context close failed for %s: %s", sid, exc)

    async def shutdown(self) -> None:
        async with self._lock:
            sids = list(self._sessions.keys())
        for sid in sids:
            await self.close(sid)
        if self._reaper_task:
            self._reaper_task.cancel()
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
        self._browser = None
        self._playwright = None

    # ----- actions ----------------------------------------------------

    async def action(self, sid: str, kind: str, **kwargs) -> Dict[str, Any]:
        """Dispatch a single browser action against the session's page."""
        session = await self.get(sid)
        page = session.page
        try:
            if kind == "goto":
                url = kwargs["url"]
                await page.goto(url, timeout=kwargs.get("timeout", 30000), wait_until="domcontentloaded")
                result = {"url": page.url}
            elif kind == "click":
                selector = kwargs.get("selector")
                x, y = kwargs.get("x"), kwargs.get("y")
                if x is not None and y is not None:
                    await page.mouse.click(x, y)
                    result = {"clicked": [x, y]}
                elif selector:
                    await page.click(selector, timeout=kwargs.get("timeout", 10000))
                    result = {"clicked": selector}
                else:
                    raise ValueError("click requires 'selector' or 'x' and 'y'")
            elif kind == "fill":
                await page.fill(kwargs["selector"], kwargs["value"], timeout=kwargs.get("timeout", 10000))
                result = {"filled": kwargs["selector"]}
            elif kind == "press":
                await page.keyboard.press(kwargs["key"])
                result = {"pressed": kwargs["key"]}
            elif kind == "scroll":
                dy = int(kwargs.get("delta_y", 400))
                await page.evaluate(f"window.scrollBy(0, {dy})")
                result = {"scrolled": dy}
            elif kind == "back":
                await page.go_back()
                result = {"url": page.url}
            elif kind == "forward":
                await page.go_forward()
                result = {"url": page.url}
            elif kind == "reload":
                await page.reload()
                result = {"url": page.url}
            elif kind == "extract_text":
                selector = kwargs.get("selector", "body")
                text = await page.locator(selector).first.inner_text(timeout=kwargs.get("timeout", 5000))
                result = {"text": text}
            elif kind == "wait_for":
                await page.wait_for_selector(kwargs["selector"], timeout=kwargs.get("timeout", 10000))
                result = {"matched": kwargs["selector"]}
            else:
                raise ValueError(f"unknown action: {kind}")

            entry = {"ts": time.time(), "action": kind, **kwargs, "ok": True}
            session.history.append(entry)
            session.touch()
            return {"ok": True, "result": result, "url": page.url}
        except Exception as exc:
            entry = {"ts": time.time(), "action": kind, **kwargs, "ok": False, "error": str(exc)}
            session.history.append(entry)
            session.touch()
            return {"ok": False, "error": str(exc), "url": page.url}

    async def screenshot(self, sid: str, quality: int = 60) -> str:
        """Return a base64-encoded JPEG of the current page."""
        session = await self.get(sid)
        png_bytes = await session.page.screenshot(type="jpeg", quality=quality, full_page=False)
        return base64.b64encode(png_bytes).decode("ascii")


session_manager = SessionManager()
