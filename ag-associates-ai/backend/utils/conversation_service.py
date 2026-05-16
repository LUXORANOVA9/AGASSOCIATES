from openai import OpenAI
from typing import List, Dict, Any, Optional
import logging
from config import LLM_BASE_URL, LLM_MODEL_NAME

logger = logging.getLogger(__name__)

class ConversationService:
    """
    Wrapper for the OpenAI Conversations API.
    Manages stateful conversation objects and items.
    """
    
    def __init__(self, api_key: str = None, base_url: str = None):
        # Fallback to config if not provided
        self.client = OpenAI(
            api_key=api_key or "not-needed",
            base_url=base_url or LLM_BASE_URL
        )

    def create_conversation(self, metadata: Dict[str, str] = None) -> str:
        """Creates a new conversation and returns its ID."""
        try:
            conversation = self.client.conversations.create(metadata=metadata)
            logger.info(f"Created conversation: {conversation.id}")
            return conversation.id
        except Exception as e:
            logger.error(f"Failed to create conversation: {e}")
            raise

    def add_message(self, conversation_id: str, role: str, content: str):
        """Adds a text message item to the conversation."""
        try:
            item = {
                "type": "message",
                "role": role,
                "content": [{"type": "text", "text": content}]
            }
            self.client.conversations.items.create(
                conversation_id=conversation_id,
                items=[item]
            )
        except Exception as e:
            logger.error(f"Failed to add message to conversation {conversation_id}: {e}")
            raise

    def add_tool_output(self, conversation_id: str, call_id: str, output: str):
        """Adds a tool response item to the conversation."""
        try:
            item = {
                "type": "function_call_output",
                "call_id": call_id,
                "output": output
            }
            self.client.conversations.items.create(
                conversation_id=conversation_id,
                items=[item]
            )
        except Exception as e:
            logger.error(f"Failed to add tool output to conversation {conversation_id}: {e}")
            raise

    def get_conversation(self, conversation_id: str):
        """Retrieves conversation details."""
        return self.client.conversations.retrieve(conversation_id)

    def list_items(self, conversation_id: str, limit: int = 20):
        """Lists items in a conversation."""
        return self.client.conversations.items.list(conversation_id=conversation_id, limit=limit)
