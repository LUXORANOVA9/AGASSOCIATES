"""Cross-platform conversation store with user identity mapping.

Each platform (whatsapp, telegram, voice, web, sms) has its own identity
scheme. This store maps them to a unified user_id and keeps conversation
history accessible from any platform.
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from config import get_database_url

logger = logging.getLogger(__name__)


def _conn():
    return psycopg2.connect(get_database_url(), cursor_factory=RealDictCursor)


# ── Schema management ────────────────────────────────────────────────────

REQUIRED_TABLES = {
    "conversations": """
        CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            platform VARCHAR(50) NOT NULL,
            platform_identity VARCHAR(255) NOT NULL,
            title VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            is_active BOOLEAN DEFAULT true
        );
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations(platform, platform_identity);
    """,
    "conversation_messages": """
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id BIGSERIAL PRIMARY KEY,
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            platform VARCHAR(50),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON conversation_messages(conversation_id, created_at);
    """,
    "user_identity_map": """
        CREATE TABLE IF NOT EXISTS user_identity_map (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            platform VARCHAR(50) NOT NULL,
            platform_identity VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            linked_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(platform, platform_identity)
        );
        CREATE INDEX IF NOT EXISTS idx_identity_user ON user_identity_map(user_id);
    """,
    "conversation_context": """
        CREATE TABLE IF NOT EXISTS conversation_context (
            id SERIAL PRIMARY KEY,
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            key VARCHAR(255) NOT NULL,
            value JSONB NOT NULL,
            UNIQUE(conversation_id, key)
        );
    """,
}


def ensure_tables():
    """Create all required tables if they don't exist. Call on startup."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                for ddl in REQUIRED_TABLES.values():
                    cur.execute(ddl)
            conn.commit()
        logger.info("Conversation store tables ensured")
    except Exception as exc:
        logger.warning("Failed to ensure conversation tables: %s", exc)


# ── User identity mapping ────────────────────────────────────────────────

def resolve_user(
    platform: str,
    platform_identity: str,
    display_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Resolve platform identity to a unified user_id. Creates mapping if new.

    Returns the stable user_id string.
    """
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id FROM user_identity_map WHERE platform = %s AND platform_identity = %s",
                    (platform, platform_identity),
                )
                row = cur.fetchone()
                if row:
                    user_id = row["user_id"]
                    if display_name:
                        cur.execute(
                            "UPDATE user_identity_map SET display_name = %s WHERE platform = %s AND platform_identity = %s",
                            (display_name, platform, platform_identity),
                        )
                        conn.commit()
                    return user_id

                user_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO user_identity_map
                       (user_id, platform, platform_identity, display_name, metadata)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (user_id, platform, platform_identity, display_name or platform_identity,
                     json.dumps(metadata or {})),
                )
                conn.commit()
                return user_id
    except Exception as exc:
        logger.error("Failed to resolve user identity: %s", exc)
        return f"{platform}:{platform_identity}"


def get_user_identities(user_id: str) -> List[Dict[str, Any]]:
    """Return all platform identities linked to this user."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT platform, platform_identity, display_name FROM user_identity_map WHERE user_id = %s",
                    (user_id,),
                )
                return [dict(row) for row in cur.fetchall()]
    except Exception as exc:
        logger.warning("Failed to get user identities: %s", exc)
        return []


# ── Conversation management ──────────────────────────────────────────────

def create_conversation(
    user_id: str,
    platform: str,
    platform_identity: str,
    title: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a new conversation. Returns conversation_id."""
    conv_id = str(uuid.uuid4())
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conversations
                       (id, user_id, platform, platform_identity, title, metadata)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (conv_id, user_id, platform, platform_identity, title,
                     json.dumps(metadata or {})),
                )
            conn.commit()
        return conv_id
    except Exception as exc:
        logger.error("Failed to create conversation: %s", exc)
        return conv_id


def get_or_create_conversation(
    user_id: str,
    platform: str,
    platform_identity: str,
    title: Optional[str] = None,
) -> str:
    """Get the most recent active conversation, or create one."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id FROM conversations
                       WHERE user_id = %s AND is_active = true
                       ORDER BY updated_at DESC LIMIT 1""",
                    (user_id,),
                )
                row = cur.fetchone()
                if row:
                    return row["id"]
    except Exception as exc:
        logger.warning("Failed to get conversation: %s", exc)

    return create_conversation(user_id, platform, platform_identity, title)


def list_conversations(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """List conversations for a user, most recent first."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, user_id, platform, platform_identity, title,
                              metadata, created_at, updated_at
                       FROM conversations
                       WHERE user_id = %s
                       ORDER BY updated_at DESC LIMIT %s""",
                    (user_id, limit),
                )
                return [dict(row) for row in cur.fetchall()]
    except Exception as exc:
        logger.warning("Failed to list conversations: %s", exc)
        return []


def update_conversation_metadata(conversation_id: str, metadata: Dict[str, Any]) -> None:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE conversations SET metadata = metadata || %s, updated_at = now() WHERE id = %s",
                    (json.dumps(metadata), conversation_id),
                )
            conn.commit()
    except Exception as exc:
        logger.warning("Failed to update conversation metadata: %s", exc)


# ── Message management ───────────────────────────────────────────────────

def add_message(
    conversation_id: str,
    role: str,
    content: str,
    platform: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    """Add a message to a conversation. Returns the message id."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conversation_messages
                       (conversation_id, role, content, platform, metadata)
                       VALUES (%s, %s, %s, %s, %s)
                       RETURNING id""",
                    (conversation_id, role, content, platform,
                     json.dumps(metadata or {})),
                )
                row = cur.fetchone()
                cur.execute(
                    "UPDATE conversations SET updated_at = now() WHERE id = %s",
                    (conversation_id,),
                )
            conn.commit()
            return row["id"] if row else 0
    except Exception as exc:
        logger.error("Failed to add message: %s", exc)
        return 0


def get_messages(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """Get messages from a conversation, oldest first."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, role, content, platform, metadata, created_at
                       FROM conversation_messages
                       WHERE conversation_id = %s
                       ORDER BY created_at ASC, id ASC
                       LIMIT %s OFFSET %s""",
                    (conversation_id, limit, offset),
                )
                return [dict(row) for row in cur.fetchall()]
    except Exception as exc:
        logger.warning("Failed to get messages: %s", exc)
        return []


def get_conversation_context_window(
    conversation_id: str,
    max_messages: int = 20,
    max_tokens_estimate: int = 4000,
) -> List[Dict[str, str]]:
    """Get messages formatted for LLM context, trimmed to fit."""
    messages = get_messages(conversation_id, limit=max_messages)

    # Format as LLM message list
    formatted = []
    char_count = 0
    for msg in reversed(messages):
        entry = {"role": msg["role"], "content": msg["content"]}
        char_count += len(msg["content"]) + 20
        formatted.append(entry)
        if char_count > max_tokens_estimate * 4:
            break

    formatted.reverse()
    return formatted


# ── Context persistence ──────────────────────────────────────────────────

def set_context(conversation_id: str, key: str, value: Any) -> None:
    """Store arbitrary JSON context scoped to a conversation."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conversation_context (conversation_id, key, value)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (conversation_id, key)
                       DO UPDATE SET value = EXCLUDED.value""",
                    (conversation_id, key, json.dumps(value)),
                )
            conn.commit()
    except Exception as exc:
        logger.warning("Failed to set context: %s", exc)


def get_context(conversation_id: str, key: str) -> Optional[Any]:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT value FROM conversation_context WHERE conversation_id = %s AND key = %s",
                    (conversation_id, key),
                )
                row = cur.fetchone()
                return row["value"] if row else None
    except Exception as exc:
        logger.warning("Failed to get context: %s", exc)
        return None


def get_all_context(conversation_id: str) -> Dict[str, Any]:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT key, value FROM conversation_context WHERE conversation_id = %s",
                    (conversation_id,),
                )
                return {row["key"]: row["value"] for row in cur.fetchall()}
    except Exception as exc:
        logger.warning("Failed to get all context: %s", exc)
        return {}
