"""Unified Aisha — cross-platform entry point for the Chief of Staff AI.

Wraps the LangGraph pipeline (legal document drafting), VoxRouter (admin
voice commands), and a general LLM chat mode into a single
platform-agnostic handler. All platform adapters (WhatsApp, Telegram, Voice,
SMS, Web, Phone) route through ``handle_message()``.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from config import LLM_BASE_URL, LLM_MODEL_NAME, LLM_MOCK_MODE
from conversation_store import (
    add_message,
    ensure_tables,
    get_conversation_context_window,
    get_or_create_conversation,
    get_all_context,
    set_context,
    resolve_user,
)
from workforce.ledger import record_activity

logger = logging.getLogger(__name__)


# ── Intent classification ────────────────────────────────────────────────

_INTENT_SYSTEM_PROMPT = """You are Aisha's intent classifier. Your job is to
categorize the user's message into exactly ONE of these intents:

- legal_draft:  User wants to draft/create/generate a rental agreement,
                leave and license, or any legal document. Contains details
                like tenant/landlord names, rent, property, deposit.
- noi_workflow: User wants to perform a NOI (Notice of Intimation) operation —
                generate challan, file NOI, check NOI status, verify NOI docs,
                start NOI process, acknowledge NOI. Usually mentions a case ID.
- admin_cmd:    User wants to run an admin operation — check case status,
                query reports, manage staff, run general RPA.
- otp_request:  User needs an OTP for GRAS, IGR, or other portal.
- general:      General conversation, questions, greetings, or anything
                that doesn't fit the above.

Respond with ONLY a JSON object:
    {{"intent": "<intent_name>", "reasoning": "<why>"}}"""


def classify_intent(message: str) -> str:
    """Classify a user message into one of the known intents."""
    if LLM_MOCK_MODE:
        if any(kw in message.lower() for kw in ["rent", "agreement", "draft", "lease", "tenant", "landlord"]):
            return "legal_draft"
        if any(kw in message.lower() for kw in ["status", "case", "challan", "noi", "rpa", "report"]):
            return "admin_cmd"
        if any(kw in message.lower() for kw in ["otp"]):
            return "otp_request"
        return "general"

    try:
        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "") or os.environ.get("OPENAI_API_KEY", ""),
            temperature=0,
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", _INTENT_SYSTEM_PROMPT),
            ("human", "{message}"),
        ])
        parser = JsonOutputParser()
        chain = prompt | llm | parser
        result = chain.invoke({"message": message})
        return result.get("intent", "general")
    except Exception as exc:
        logger.warning(f"Intent classification failed, defaulting to general: {exc}")
        return "general"


# ── General chat mode ────────────────────────────────────────────────────

_GENERAL_SYSTEM_PROMPT = """You are Aisha, the Chief of Staff AI at AG
Associates — a legal technology firm operating in Maharashtra, India.

You help the Principal (the firm's owner/advocate) with daily operations.
Your tone is professional, concise, and warm.

You can:
- Answer questions about case status, NOI workflow, and firm operations
- Remind about deadlines and compliance requirements
- Coordinate the agent workforce (Vyasa, Drafter, Auditor, Accountant)
- Handle general queries about Indian property law and registration

When you don't know something, say so clearly. Never fabricate case data.
Never expose internal credentials or API keys.

If the user wants to draft a legal document, ask them for the specific
details (names, property, amounts, dates) so you can initiate the drafting
pipeline.

Current time: {current_time}"""


def _general_chat(message: str, context_messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """Handle general conversation using LLM with conversation history."""
    try:
        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "") or os.environ.get("OPENAI_API_KEY", ""),
            temperature=0.7,
        )
    except Exception as exc:
        logger.warning(f"Cannot initialise LLM for general chat, falling back: {exc}")
        return {"success": True, "response": "Aisha is warming up. Could you ask again in a moment?"}

    prompt = ChatPromptTemplate.from_messages([
        ("system", _GENERAL_SYSTEM_PROMPT.format(
            current_time=datetime.now().isoformat()
        )),
        *[{"role": m["role"], "content": m["content"].replace("{", "{{").replace("}", "}}")} for m in context_messages[-10:]],
        ("human", "{message}"),
    ])

    try:
        chain = prompt | llm
        response = chain.invoke({"message": message})
        text = response.content if hasattr(response, "content") else str(response)
        return {"success": True, "response": text}
    except Exception as exc:
        logger.error(f"General chat failed: {exc}")
        return {"success": True, "response": "Aisha is warming up. Could you ask again in a moment?"}


# ── Legal drafting mode ──────────────────────────────────────────────────

def _legal_draft(message: str) -> Dict[str, Any]:
    """Route to the LangGraph rental agreement pipeline."""
    from agents import process_rental_request
    import asyncio

    try:
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(
            asyncio.to_thread(process_rental_request, message, "aisha_core", None)
        )
        loop.close()

        if result.get("success"):
            state = result.get("state", {})
            pdf_path = state.get("pdf_path")
            audit_passed = state.get("audit_passed", False)
            extracted = state.get("extracted_json", {})

            summary_parts = ["I've processed your request. Here's what I extracted:"]
            if extracted:
                for k, v in extracted.items():
                    if v:
                        summary_parts.append(f"  • {k.replace('_', ' ').title()}: {v}")

            summary_parts.append("")
            if audit_passed:
                summary_parts.append("✅ The draft passed quality audit.")
            else:
                summary_parts.append("⚠️ The draft needs review — it didn't pass the quality audit.")

            if pdf_path:
                summary_parts.append(f"📄 Document generated at: {pdf_path}")

            return {
                "success": True,
                "response": "\n".join(summary_parts),
                "data": result,
            }
        else:
            return {
                "success": False,
                "response": f"I couldn't process your legal drafting request: {result.get('error', 'Unknown error')}",
            }
    except Exception as exc:
        logger.error(f"Legal draft failed: {exc}")
        return {
            "success": False,
            "response": f"The drafting pipeline encountered an error: {exc}",
        }


# ── Main handler ─────────────────────────────────────────────────────────

def handle_message(
    message: str,
    *,
    platform: str,
    platform_identity: str,
    display_name: Optional[str] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Single entry point for all platforms.

    Args:
        message: The user's text message.
        platform: One of 'whatsapp', 'telegram', 'voice', 'web', 'sms', 'phone'.
        platform_identity: Platform-specific user ID (phone number, chat_id, etc).
        display_name: Optional human-readable name.
        conversation_id: Existing conversation to continue, or None to create new.

    Returns:
        Dict with 'response' (text reply), 'conversation_id', and optional
        'audio' (WAV bytes for voice platforms).
    """
    ensure_tables()

    user_id = resolve_user(platform, platform_identity, display_name)

    conv_id = conversation_id or get_or_create_conversation(
        user_id, platform, platform_identity,
        title=message[:100],
    )

    add_message(conv_id, "user", message, platform)

    context = get_conversation_context_window(conv_id)
    intent = classify_intent(message)

    set_context(conv_id, "last_intent", intent)
    set_context(conv_id, "last_platform", platform)

    record_activity(
        source=platform,
        staff_kind="agent",
        staff_short_name="aisha",
        capability_code=f"chat.{intent}",
        summary=f"{platform}/{intent}: {message[:80]}",
        payload={"user_id": user_id, "conversation_id": conv_id, "intent": intent},
        org_id=None,
    )

    if intent == "legal_draft":
        result = _legal_draft(message)
    elif intent == "admin_cmd":
        result = _admin_command(message, context)
    else:
        result = _general_chat(message, context)

    response_text = result.get("response", "I'm not sure how to respond to that.")
    add_message(conv_id, "assistant", response_text, platform)

    return {
        "conversation_id": conv_id,
        "user_id": user_id,
        "response": response_text,
        "intent": intent,
        "data": result.get("data"),
        "audio": result.get("audio"),
    }


# ── Admin command mode ───────────────────────────────────────────────────

_ADMIN_SYSTEM_PROMPT = """You are Aisha, Chief of Staff AI at AG Associates.
The user wants to perform an admin operation.

Current available capabilities:
- Check case status (case number required)
- Generate GRAS challan for NOI
- File NOI on IGR portal
- Run GRAS RPA
- Run IGR RPA
- Get reports and analytics
- Manage staff

For any operation that requires action (generating challan, filing, running
RPA), you need to confirm with the user first before proceeding.

If you cannot perform the operation directly, explain what information you
need from the user to proceed.

Current time: {current_time}"""


def _admin_command(message: str, context_messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """Handle admin commands using the VoxRouter tool registry."""
    from voice.tool_registry import tool_registry
    from voice.vox_router import vox_router

    decision = vox_router.route(message)
    tool_name = decision.get("tool")

    if tool_name:
        try:
            output = tool_registry.execute(tool_name, decision.get("args") or {})
            return {
                "success": True,
                "response": f"✅ Executed `{tool_name}`.\n\nResult: {json.dumps(output, indent=2, default=str)}",
                "data": {"tool": tool_name, "output": output},
            }
        except Exception as exc:
            logger.warning(f"Tool {tool_name} failed, falling back to LLM: {exc}")

    try:
        llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key=os.environ.get("LLM_API_KEY", "") or os.environ.get("OPENAI_API_KEY", ""),
            temperature=0.3,
        )
    except Exception as exc:
        logger.warning(f"Cannot initialise LLM for admin command: {exc}")
        return {"success": True, "response": "Aisha's admin module is warming up. Could you ask again in a moment?"}

    tools_summary = "\n".join(
        f"  • {d.name}: {d.description}"
        for d in tool_registry.definitions
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", _ADMIN_SYSTEM_PROMPT.format(
            current_time=datetime.now().isoformat()
        ) + f"\n\nTools available:\n{tools_summary}"),
        *[{"role": m["role"], "content": m["content"].replace("{", "{{").replace("}", "}}")} for m in context_messages[-5:]],
        ("human", "{message}"),
    ])

    try:
        chain = prompt | llm
        response = chain.invoke({"message": message})
        text = response.content if hasattr(response, "content") else str(response)
        return {"success": True, "response": text}
    except Exception as exc:
        logger.error(f"Admin command failed: {exc}")
        return {"success": True, "response": "Aisha's admin module is warming up. Could you ask again in a moment?"}
