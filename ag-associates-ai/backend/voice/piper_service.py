"""Piper TTS wrapper. Lazy-loads the voice model on first call.

Falls back to silent mode (returns empty bytes) when piper isn't installed,
so the API remains usable in dev environments without the C extension.
"""
from __future__ import annotations

import io
import logging
import os
import wave
from typing import Optional

logger = logging.getLogger(__name__)

_VOICE = None
_VOICE_PATH = os.environ.get(
    "PIPER_VOICE_PATH",
    # Default to a Hindi voice since the firm operates in Maharashtra.
    "/models/piper/hi_IN-pratham-medium.onnx",
)

try:
    from piper.voice import PiperVoice  # type: ignore
    HAS_PIPER = True
except ImportError:
    HAS_PIPER = False
    logger.warning("piper-tts not installed. PiperService will run in SILENT mode.")


def _get_voice():
    global _VOICE
    if not HAS_PIPER:
        return None
    if _VOICE is None:
        if not os.path.exists(_VOICE_PATH):
            logger.warning(f"Piper voice not found at {_VOICE_PATH}; running silent.")
            return None
        logger.info(f"Loading Piper voice from {_VOICE_PATH}")
        _VOICE = PiperVoice.load(_VOICE_PATH)
    return _VOICE


def synthesize(text: str) -> bytes:
    """Return WAV bytes for the given text. Empty bytes on failure/silent mode."""
    voice = _get_voice()
    if voice is None or not text:
        return b""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        voice.synthesize(text, wav)
    return buf.getvalue()
