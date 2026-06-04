"""AG Digital Office Playground — real browser sandboxes via Playwright.

Not a simulation. Each session is a live Chromium context the admin can
drive (navigate / click / type / screenshot / extract text) through the
playground API and watch frame-by-frame from the office UI.
"""

from .playground_api import router as playground_router
from .browser_session import session_manager

__all__ = ["playground_router", "session_manager"]
