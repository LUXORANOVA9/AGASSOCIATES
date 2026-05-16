"""Vyasa Voice Control — Phase 1.

Open-source voice-to-action pipeline:
    audio → faster-whisper STT → vox_router (LLM intent) → tool registry → piper TTS
plus an admin-only FastAPI router and a Postgres audit log.

All heavy models load lazily so importing this package is cheap.
"""

from .voice_api import router as voice_router

__all__ = ["voice_router"]
