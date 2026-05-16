import json
import os
import subprocess
import httpx
import logging
from typing import Dict, List, Any, Optional, Union

logger = logging.getLogger(__name__)

class MCPClient:
    """
    Unified client to interact with Model Context Protocol (MCP) servers.
    Supports both HTTP and Stdio transports.
    """
    
    def __init__(self, config_paths: List[str] = None):
        self.config_paths = config_paths or [
            os.path.expanduser("~/.gemini/antigravity/mcp_config.json"),
            ".mcp.json"
        ]
        self.servers = {}
        self._load_configs()

    def _load_configs(self):
        """Loads MCP server configurations from provided paths."""
        for path in self.config_paths:
            if not os.path.exists(path):
                continue
            try:
                with open(path, 'r') as f:
                    config = json.load(f)
                    servers = config.get("mcpServers", {})
                    for name, srv_config in servers.items():
                        self.servers[name] = srv_config
                logger.info(f"Loaded MCP config from {path}")
            except Exception as e:
                logger.error(f"Failed to load MCP config from {path}: {e}")

    async def list_tools(self, server_name: str) -> List[Dict[str, Any]]:
        """Lists tools available on a specific MCP server."""
        config = self.servers.get(server_name)
        if not config:
            raise ValueError(f"Server {server_name} not found in config")

        if "url" in config or "serverUrl" in config:
            return await self._list_tools_http(server_name, config)
        elif "command" in config:
            return await self._list_tools_stdio(server_name, config)
        else:
            raise ValueError(f"Unsupported transport for server {server_name}")

    async def _list_tools_http(self, name: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        url = config.get("url") or config.get("serverUrl")
        headers = config.get("headers", {})
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json={"jsonrpc": "2.0", "id": "list", "method": "tools/list", "params": {}},
                    headers=headers,
                    timeout=10.0
                )
                response.raise_for_status()
                result = response.json()
                return result.get("result", {}).get("tools", [])
            except Exception as e:
                logger.error(f"Failed to list tools from HTTP server {name}: {e}")
                return []

    async def _list_tools_stdio(self, name: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Stdio implementation requires a persistent process or a single-shot call if the server supports it.
        # Most MCP stdio servers expect persistent JSON-RPC.
        # For simplicity in this utility, we'll log that stdio is pending robust implementation.
        logger.warning(f"Stdio transport for {name} is partially implemented.")
        return []

    async def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a tool on a specific MCP server."""
        config = self.servers.get(server_name)
        if not config:
            raise ValueError(f"Server {server_name} not found")

        if "url" in config or "serverUrl" in config:
            return await self._call_tool_http(server_name, tool_name, arguments, config)
        else:
            raise NotImplementedError("Only HTTP tool calling is currently implemented")

    async def _call_tool_http(self, server_name: str, tool_name: str, arguments: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        url = config.get("url") or config.get("serverUrl")
        headers = config.get("headers", {})
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json={
                        "jsonrpc": "2.0", 
                        "id": secrets.token_hex(4), 
                        "method": "tools/call", 
                        "params": {
                            "name": tool_name,
                            "arguments": arguments
                        }
                    },
                    headers=headers,
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json().get("result", {})
            except Exception as e:
                logger.error(f"Failed to call tool {tool_name} on {server_name}: {e}")
                return {"isError": True, "content": [{"type": "text", "text": str(e)}]}

import secrets
