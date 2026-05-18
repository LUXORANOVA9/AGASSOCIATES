"""
LangGraph agent pipeline for AG Associates AI.

Public API is re-exported here so existing imports keep working after the
split from a single agents.py file. main.py uses `from agents import
process_rental_request`; that path stays valid.

Pipeline: Aisha (intake) → Guardrail (regex) → Bouncer (math) → Drafter
(RAG + LLM) → Auditor (QA, may loop back to Drafter up to 3 times).
"""

from .db import generate_embedding, get_db_connection, similarity_search
from .graph import build_agent_graph, process_rental_request, should_revise
from .state import AgentState

__all__ = [
    "AgentState",
    "build_agent_graph",
    "generate_embedding",
    "get_db_connection",
    "process_rental_request",
    "should_revise",
    "similarity_search",
]
