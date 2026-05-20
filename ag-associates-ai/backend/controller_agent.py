import logging
import json
from typing import List, Dict, Any, Optional
from utils.mcp_client import MCPClient
from utils.conversation_service import ConversationService
from config import LLM_MODEL_NAME

logger = logging.getLogger(__name__)

class UnifiedController:
    """
    The main autonomous controller for AG Associates.
    Orchestrates workforce tasks using OpenAI Conversations and MCP tools.
    """
    
    def __init__(self):
        self.mcp = MCPClient()
        self.conv_service = ConversationService()
        self.active_tools = {} # Maps tool_name -> server_name
        self._refresh_tools()

    def _refresh_tools(self):
        """Discovers and caches tools from all configured MCP servers."""
        logger.info("Refreshing MCP tools...")
        # For now, we'll focus on known primary servers
        primary_servers = ["cloudrun", "firebase-mcp-server", "stitch", "postman", "cc-workflow-studio"]
        
        for server in primary_servers:
            try:
                # This is a placeholder since list_tools is async in our implementation
                # In a real sync initialization, we'd use an event loop.
                pass 
            except Exception as e:
                logger.error(f"Failed to refresh tools for {server}: {e}")

    async def handle_request(self, user_input: str, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Main entry point for handling a user request via the unified controller.
        """
        if not conversation_id:
            conversation_id = self.conv_service.create_conversation(metadata={"agent": "unified_controller"})
        
        # 1. Add user message
        self.conv_service.add_message(conversation_id, "user", user_input)
        
        # 2. Get AI response (This would normally involve a loop for tool calling)
        # Note: The OpenAI Conversations API handles state, but the 'response' logic 
        # is often part of a separate 'Response' or 'Assistant' call depending on the SDK version.
        
        # For this implementation, we assume a pattern where we can 'generate' from the conversation.
        # Since the 'conversations' resource is for state management, we use it to build context.
        
        logger.info(f"Processing request in conversation {conversation_id}")
        
        # Placeholder for the generation loop
        # 1. Fetch available tools from MCP
        # 2. Send current conversation context + tools to LLM
        # 3. Execute any tool calls
        # 4. Return final response
        
        return {
            "conversation_id": conversation_id,
            "status": "processing",
            "message": "Unified controller is handling your request."
        }

    async def execute_mcp_action(self, server: str, tool: str, args: Dict[str, Any]):
        """Directly executes an MCP action and returns result."""
        return await self.mcp.call_tool(server, tool, args)
