"""Dynamic selector configuration — Supabase-backed with env var / default fallback.

Priority: Supabase config table > env vars (IGR_SEL_* / GRAS_SEL_*) > hardcoded defaults

The supabase_config table schema:
  - portal (text): 'igr' | 'gras' | 'nesl'
  - selector_key (text): e.g. 'username_input'
  - selector_value (text): e.g. "input[name='username']"
  - updated_at (timestamptz)
  - updated_by (text)

Add a unique constraint on (portal, selector_key).
"""

import json
import logging
import os
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_SELECTOR_CACHE: Dict[str, Dict[str, str]] = {}
_CACHE_TTL_SECONDS = 300


async def _fetch_from_supabase(portal: str) -> Dict[str, str]:
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not supabase_key:
        return {}

    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{supabase_url}/rest/v1/supabase_config",
                params={
                    "portal": f"eq.{portal}",
                    "select": "selector_key,selector_value",
                },
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            rows = resp.json()
            return {row["selector_key"]: row["selector_value"] for row in rows} if isinstance(rows, list) else {}
    except Exception as exc:
        logger.warning("Supabase selector fetch failed for %s: %s", portal, exc)
        return {}


def get_selector(portal: str, key: str, default: str) -> str:
    """Resolve a selector: Supabase config > env var > default."""
    env_key = {"igr": "IGR_SEL_", "gras": "GRAS_SEL_", "nesl": "NESL_SEL_"}.get(portal, f"{portal.upper()}_SEL_")
    env_val = os.environ.get(f"{env_key}{key.upper()}")
    if env_val:
        return env_val
    return default


async def load_portal_selectors(portal: str, defaults: Dict[str, str]) -> Dict[str, str]:
    """Load selectors for a portal. Merges Supabase overrides atop defaults."""
    selectors = dict(defaults)
    overrides = await _fetch_from_supabase(portal)
    for k, v in overrides.items():
        if v:
            selectors[k] = v
    for k in selectors:
        selectors[k] = get_selector(portal, k, selectors[k])
    return selectors
