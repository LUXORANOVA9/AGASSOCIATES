"""Standalone "Hey Vyasa" wake-word listener.

Run this as its own process on the machine that has the desk microphone:

    python -m voice.wakeword_listener

It mic-streams via sounddevice, runs openWakeWord, and on detection records
the next 5 s of audio and POSTs it to /voice/command. Keep VOICE_ADMIN_KEY
in the environment so the listener can authenticate.

This module is intentionally **not** imported by the FastAPI app — the
backend container has no mic and the heavy audio deps should stay optional.
"""
from __future__ import annotations

import io
import logging
import os
import sys
import time
import wave
from typing import Optional

import httpx

logger = logging.getLogger("vyasa.wakeword")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

API_BASE = os.environ.get("VOICE_API_BASE", "http://localhost:8000")
ADMIN_KEY = os.environ.get("VOICE_ADMIN_KEY", "")
USER_ID = os.environ.get("VOICE_WAKEWORD_USER_ID", "desk-mic")
WAKE_MODEL = os.environ.get("WAKEWORD_MODEL", "hey_jarvis_v0.1")  # ship custom "hey_vyasa" once trained
SAMPLE_RATE = 16000
CHUNK_MS = 80
COMMAND_SECONDS = float(os.environ.get("WAKEWORD_COMMAND_SECONDS", "5"))


def _record_wav(seconds: float) -> bytes:
    import numpy as np  # type: ignore
    import sounddevice as sd  # type: ignore

    frames = int(seconds * SAMPLE_RATE)
    audio = sd.rec(frames, samplerate=SAMPLE_RATE, channels=1, dtype="int16")
    sd.wait()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(audio.tobytes())
    return buf.getvalue()


def _post_command(wav_bytes: bytes) -> Optional[dict]:
    if not ADMIN_KEY:
        logger.error("VOICE_ADMIN_KEY not set — cannot authenticate to /voice/command")
        return None
    headers = {"x-voice-admin-key": ADMIN_KEY, "x-user-id": USER_ID}
    files = {"file": ("wakeword.wav", wav_bytes, "audio/wav")}
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{API_BASE}/voice/command", headers=headers, files=files)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.error("POST /voice/command failed: %s", exc)
        return None


def main() -> int:
    try:
        import numpy as np  # type: ignore
        import sounddevice as sd  # type: ignore
        from openwakeword.model import Model  # type: ignore
    except ImportError as exc:
        logger.error("Missing audio deps (%s). pip install openwakeword sounddevice numpy", exc)
        return 2

    model = Model(wakeword_models=[WAKE_MODEL])
    chunk_size = int(SAMPLE_RATE * CHUNK_MS / 1000)
    logger.info("Listening for wake word=%s …", WAKE_MODEL)

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16", blocksize=chunk_size) as stream:
        while True:
            block, _ = stream.read(chunk_size)
            scores = model.predict(np.squeeze(block))
            triggered = any(score > 0.5 for score in scores.values())
            if not triggered:
                continue
            logger.info("Wake word detected — recording %.1fs of command audio", COMMAND_SECONDS)
            time.sleep(0.2)  # tiny gap so the user can start speaking
            wav_bytes = _record_wav(COMMAND_SECONDS)
            result = _post_command(wav_bytes)
            logger.info("Command result: %s", result)


if __name__ == "__main__":
    sys.exit(main())
