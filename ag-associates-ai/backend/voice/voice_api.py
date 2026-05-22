"""Admin Voice Control API — Phase 1.

Hardened entrypoint for the voice automation system:
  • Admin-only via X-Voice-Admin-Key shared secret
  • Kill switch via VOICE_SYSTEM_ENABLED env
  • Whisper STT → VoxRouter intent → risk-gated execution
  • LOW-risk tools auto-execute; MED/HIGH return a pending command_id that
    must be confirmed via /voice/confirm/{id}
  • Every command (success, denied, errored) lands in voice_command_logs
"""
from __future__ import annotations

import logging
import os
import secrets
import sys
import shutil
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, Response, UploadFile, status

from . import audit, rate_limit, rbac, whatsapp
from .piper_service import synthesize
from .tool_registry import tool_registry
from .vox_router import vox_router
from .whisper_service import whisper_service

try:
    from utils.s3 import generate_presigned_upload_url, generate_presigned_url, s3_client, BUCKET_NAME
    _HAS_S3 = True
except Exception:
    _HAS_S3 = False

try:
    from workforce.ledger import record_activity as _record_activity
except Exception:
    def _record_activity(**_kwargs):  # type: ignore
        return None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["Voice Automation"])

TEMP_DIR = os.environ.get("VOICE_TEMP_DIR", "temp_audio")
os.makedirs(TEMP_DIR, exist_ok=True)

VOICE_ADMIN_KEY = os.environ.get("VOICE_ADMIN_KEY", "")
N8N_WHATSAPP_INBOUND_KEY = os.environ.get("N8N_WHATSAPP_INBOUND_KEY", "")
WHATSAPP_PHONE_TO_USER = {
    # Map E.164 phone → admin user_id. Override with env JSON if you have many.
    # e.g. {"+919699218421": "aditya"}
}
try:
    import json as _json
    _override = os.environ.get("VOICE_PHONE_USER_MAP")
    if _override:
        WHATSAPP_PHONE_TO_USER.update(_json.loads(_override))
except Exception:
    logger.warning("VOICE_PHONE_USER_MAP could not be parsed; using empty map")


def _system_enabled() -> bool:
    return os.environ.get("VOICE_SYSTEM_ENABLED", "true").lower() != "false"


def _verify_admin(
    x_voice_admin_key: Optional[str] = Header(default=None, alias="x-voice-admin-key"),
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> str:
    if not VOICE_ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="voice admin auth not configured",
        )
    if not x_voice_admin_key or not secrets.compare_digest(x_voice_admin_key, VOICE_ADMIN_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid admin key")
    return x_user_id or "admin"


def _risk_of(tool_name: Optional[str]) -> str:
    if not tool_name:
        return "none"
    definition = tool_registry.get_definition(tool_name)
    return definition.risk.lower() if definition else "unknown"


@router.get("/health")
async def voice_health():
    return {
        "enabled": _system_enabled(),
        "auth_configured": bool(VOICE_ADMIN_KEY),
        "tool_count": len(tool_registry.definitions),
    }


@router.get("/tools")
async def list_voice_tools(_: str = Depends(_verify_admin)):
    return tool_registry.get_tool_schemas()


def _archive_audio(file_path: str, command_id: str) -> Optional[str]:
    """Upload the raw audio to the S3 vault for later replay. Returns the
    S3 key on success, None when S3 isn't configured."""
    if not _HAS_S3:
        return None
    key = f"voice/{command_id}.bin"
    try:
        with open(file_path, "rb") as fh:
            s3_client.put_object(Bucket=BUCKET_NAME, Key=key, Body=fh.read())
        return key
    except Exception as exc:
        logger.warning("audio archive failed: %s", exc)
        return None


def _process_transcript(
    transcript: str,
    *,
    user_id: str,
    caller_roles: list[str],
    phone: Optional[str] = None,
    audio_s3_key: Optional[str] = None,
) -> dict:
    """Shared route+risk+execute pipeline used by mic, wake-word, and WhatsApp."""
    decision = vox_router.route(transcript)
    tool_name = decision.get("tool")
    default_risk = _risk_of(tool_name)

    if not tool_name:
        # Fall through to unified Aisha for natural-language queries
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
            from aisha_core import handle_message as aisha_handle
            aisha_result = aisha_handle(
                transcript,
                platform="voice",
                platform_identity=user_id,
                display_name=user_id,
            )
            command_id = audit.log_command(
                user_id=user_id, transcript=transcript, detected_language=None,
                decision={"fallback": "aisha_core"}, risk="low", status="aisha_fallback",
                result={"aisha_response": aisha_result.get("response", "")},
                audio_s3_key=audio_s3_key,
            )
            return {
                "success": True, "command_id": command_id, "transcript": transcript,
                "routing": {"fallback": "aisha_core", "aisha_intent": aisha_result.get("intent")},
                "execution": {"executed": True, "aisha_response": aisha_result.get("response")},
            }
        except Exception as aisha_exc:
            logger.warning("Aisha core fallback also failed: %s", aisha_exc)

        command_id = audit.log_command(
            user_id=user_id, transcript=transcript, detected_language=None,
            decision=decision, risk=default_risk, status="unrouted",
            audio_s3_key=audio_s3_key,
        )
        return {"success": False, "command_id": command_id, "transcript": transcript,
                "routing": decision, "execution": {"executed": False, "reason": "no matching tool"}}

    gate = rbac.check(tool_name, default_risk, caller_roles)
    if not gate["allowed"]:
        command_id = audit.log_command(
            user_id=user_id, transcript=transcript, detected_language=None,
            decision=decision, risk=default_risk, status="denied",
            result={"reason": gate["reason"]}, audio_s3_key=audio_s3_key,
        )
        return {"success": False, "command_id": command_id, "transcript": transcript,
                "routing": decision, "execution": {"executed": False, "reason": gate["reason"]}}

    effective_risk = gate["effective_risk"]

    # Capability code is conventionally the tool name; if a tool registers a
    # canonical capability later this lookup can be made explicit.
    capability_code = decision.get("capability_code") or tool_name
    limit = rate_limit.get_limit_for_capability(capability_code)
    rl = rate_limit.check_and_consume("voice", capability_code, user_id, limit)
    if not rl["allowed"]:
        command_id = audit.log_command(
            user_id=user_id, transcript=transcript, detected_language=None,
            decision=decision, risk=effective_risk, status="denied",
            result={"reason": rl["reason"], "rate_limit": rl}, audio_s3_key=audio_s3_key,
        )
        return {"success": False, "command_id": command_id, "transcript": transcript,
                "routing": decision,
                "execution": {"executed": False, "reason": rl["reason"]}}

    if effective_risk != "low":
        command_id = audit.log_command(
            user_id=user_id, transcript=transcript, detected_language=None,
            decision=decision, risk=effective_risk, status="pending_confirm",
            audio_s3_key=audio_s3_key,
        )
        if phone:
            whatsapp.send_confirm_prompt(phone, transcript, tool_name, decision.get("args") or {}, command_id)
        return {"success": True, "command_id": command_id, "transcript": transcript,
                "routing": decision,
                "execution": {"executed": False, "requires_confirm": True,
                              "reason": f"{effective_risk} risk — confirm via POST /voice/confirm/{command_id}"}}

    try:
        output = tool_registry.execute(tool_name, decision.get("args") or {})
        exec_result = {"executed": True, "output": output}
        status_str = "executed"
    except Exception as exc:
        logger.exception("Tool %s crashed", tool_name)
        exec_result = {"executed": False, "reason": f"tool error: {exc}"}
        status_str = "tool_error"

    command_id = audit.log_command(
        user_id=user_id, transcript=transcript, detected_language=None,
        decision=decision, risk=effective_risk, status=status_str, result=exec_result,
        audio_s3_key=audio_s3_key,
    )
    _record_activity(
        source="voice", staff_kind="agent", staff_short_name="vox",
        capability_code="voice.command",
        summary=f"voice: {transcript[:80]} → {tool_name}",
        payload={
            "user_id": user_id,
            "args": decision.get("args") or {},
            "exec": exec_result,
            "command_id": command_id,
        },
        status="ok" if exec_result["executed"] else "warn",
    )
    return {"success": exec_result["executed"], "command_id": command_id, "transcript": transcript,
            "routing": decision, "execution": exec_result}


@router.post("/command")
async def handle_voice_command(
    file: UploadFile = File(...),
    user_id: str = Depends(_verify_admin),
    x_roles: Optional[str] = Header(default=None, alias="x-roles"),
):
    """Receive an audio blob, transcribe it, route to a tool, gate by risk."""
    if not _system_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="voice system disabled")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(TEMP_DIR, f"{file_id}_{file.filename or 'cmd.wav'}")
    roles = [r.strip() for r in (x_roles or "admin").split(",") if r.strip()]

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        transcript = whisper_service.transcribe(file_path)
        if not transcript:
            raise HTTPException(status_code=400, detail="Could not transcribe audio")

        s3_key = _archive_audio(file_path, file_id)
        return _process_transcript(transcript, user_id=user_id, caller_roles=roles, audio_s3_key=s3_key)
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass


def _execute_pending(command_id: str, expected_user: Optional[str]) -> dict:
    pending = audit.get_pending(command_id)
    if pending is None:
        raise HTTPException(status_code=404, detail="command not found")
    if pending["status"] != "pending_confirm":
        raise HTTPException(status_code=409, detail=f"command in state {pending['status']!r}")
    if expected_user and pending["user_id"] and pending["user_id"] != expected_user:
        raise HTTPException(status_code=403, detail="confirmation must come from the originating user")

    # TTL guard — refuse to execute confirmations that arrived too late.
    from datetime import datetime, timezone
    created = pending["created_at"]
    if created and (datetime.now(timezone.utc) - created).total_seconds() > whatsapp.CONFIRM_TTL_SECONDS:
        audit.mark_denied(command_id, "confirmation TTL exceeded")
        raise HTTPException(status_code=410, detail="confirmation window expired")

    try:
        output = tool_registry.execute(pending["tool_name"], pending["tool_args"] or {})
        result = {"executed": True, "output": output}
    except Exception as exc:
        logger.exception("Confirmed tool %s crashed", pending["tool_name"])
        result = {"executed": False, "reason": f"tool error: {exc}"}

    audit.mark_confirmed(command_id, result)
    return result


@router.post("/confirm/{command_id}")
async def confirm_voice_command(command_id: str, user_id: str = Depends(_verify_admin)):
    """Execute a MED/HIGH-risk command after explicit admin confirmation."""
    if not _system_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="voice system disabled")
    result = _execute_pending(command_id, user_id)
    return {"command_id": command_id, "execution": result}


# ----- WhatsApp bridge ---------------------------------------------------

def _verify_n8n(x_inbound_key: Optional[str] = Header(default=None, alias="x-inbound-key")) -> None:
    if not N8N_WHATSAPP_INBOUND_KEY:
        raise HTTPException(status_code=503, detail="WhatsApp inbound not configured")
    if not x_inbound_key or not secrets.compare_digest(x_inbound_key, N8N_WHATSAPP_INBOUND_KEY):
        raise HTTPException(status_code=401, detail="invalid inbound key")


@router.post("/whatsapp/inbound")
async def whatsapp_inbound_voice(
    payload: dict = Body(...),
    _: None = Depends(_verify_n8n),
):
    """n8n forwards a WhatsApp voice note here. Expected payload:
        {"from": "+91…", "media_url": "https://…", "media_token": "...optional"}
    """
    if not _system_enabled():
        raise HTTPException(status_code=503, detail="voice system disabled")

    phone = (payload.get("from") or "").strip()
    media_url = payload.get("media_url")
    if not phone or not media_url:
        raise HTTPException(status_code=400, detail="missing 'from' or 'media_url'")

    user_id = WHATSAPP_PHONE_TO_USER.get(phone, phone)
    roles = ["admin"] if phone in WHATSAPP_PHONE_TO_USER else ["whatsapp"]

    headers = {}
    if payload.get("media_token"):
        headers["Authorization"] = f"Bearer {payload['media_token']}"

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(media_url, headers=headers)
            resp.raise_for_status()
            audio_bytes = resp.content
    except Exception as exc:
        logger.error("WhatsApp media download failed: %s", exc)
        raise HTTPException(status_code=502, detail="could not fetch WhatsApp media")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(TEMP_DIR, f"{file_id}_wa.ogg")
    try:
        with open(file_path, "wb") as fh:
            fh.write(audio_bytes)
        transcript = whisper_service.transcribe(file_path)
        if not transcript:
            raise HTTPException(status_code=400, detail="empty transcription")
        s3_key = _archive_audio(file_path, file_id)
        return _process_transcript(transcript, user_id=user_id, caller_roles=roles, phone=phone, audio_s3_key=s3_key)
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass


@router.post("/whatsapp/reply")
async def whatsapp_reply(
    payload: dict = Body(...),
    _: None = Depends(_verify_n8n),
):
    """Handles 'YES'/'NO' replies. Expected payload:
        {"from": "+91…", "text": "yes"}
    """
    phone = (payload.get("from") or "").strip()
    text = (payload.get("text") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="missing 'from'")

    user_id = WHATSAPP_PHONE_TO_USER.get(phone, phone)
    intent = whatsapp.classify_reply(text)
    pending = audit.get_latest_pending_for_user(user_id, max_age_seconds=whatsapp.CONFIRM_TTL_SECONDS)

    if not pending:
        return {"matched": False, "reason": "no pending command in TTL window"}

    if intent == "approve":
        result = _execute_pending(pending["id"], user_id)
        return {"matched": True, "command_id": pending["id"], "execution": result}
    if intent == "deny":
        audit.mark_denied(pending["id"], "user denied via WhatsApp")
        return {"matched": True, "command_id": pending["id"], "execution": {"executed": False, "reason": "user denied"}}
    return {"matched": False, "reason": "reply did not match yes/no"}


# ----- Admin tool-config (per-tool RBAC) ---------------------------------

@router.get("/admin/tool-config")
async def list_tool_config(_: str = Depends(_verify_admin)):
    """Return registry defaults merged with any DB overrides."""
    out = []
    for d in tool_registry.definitions:
        cfg = rbac.get_config(d.name) or {}
        out.append({
            "name": d.name,
            "description": d.description,
            "default_risk": d.risk,
            "enabled": cfg.get("enabled", True),
            "risk_override": cfg.get("risk_override"),
            "allowed_roles": cfg.get("allowed_roles", []),
        })
    return out


@router.post("/admin/tool-config/{tool_name}")
async def upsert_tool_config(
    tool_name: str,
    payload: dict = Body(...),
    _: str = Depends(_verify_admin),
):
    if tool_registry.get_definition(tool_name) is None:
        raise HTTPException(status_code=404, detail="unknown tool")
    rbac.upsert(
        tool_name,
        enabled=bool(payload.get("enabled", True)),
        risk_override=payload.get("risk_override"),
        allowed_roles=list(payload.get("allowed_roles") or []),
    )
    return {"ok": True}


# ----- Audio replay ------------------------------------------------------

@router.get("/audio/{command_id}")
async def voice_audio(command_id: str, _: str = Depends(_verify_admin)) -> dict:
    """Return a short-lived presigned URL the admin UI can use to replay the
    original command audio. 404 when the row has no archived audio."""
    pending = audit.get_pending(command_id)
    if pending is None:
        # Audit row may already be confirmed/denied — look up audio_s3_key directly.
        import psycopg2
        from config import get_database_url
        with psycopg2.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT audio_s3_key FROM voice_command_logs WHERE id = %s", (command_id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="command not found")
                audio_key = row[0]
    else:
        import psycopg2
        from config import get_database_url
        with psycopg2.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT audio_s3_key FROM voice_command_logs WHERE id = %s", (command_id,))
                row = cur.fetchone()
                audio_key = row[0] if row else None

    if not audio_key:
        raise HTTPException(status_code=404, detail="no archived audio for this command")
    if not _HAS_S3:
        raise HTTPException(status_code=503, detail="audio archive not configured")

    url = generate_presigned_url(audio_key, expiration=60)
    return {"command_id": command_id, "url": url, "expires_in": 60}


@router.get("/speak")
async def speak(text: str, _: str = Depends(_verify_admin)) -> Response:
    """Render a short message as Piper TTS audio for the admin UI."""
    if not _system_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="voice system disabled")
    wav = synthesize(text)
    if not wav:
        raise HTTPException(status_code=503, detail="TTS unavailable")
    return Response(content=wav, media_type="audio/wav")
