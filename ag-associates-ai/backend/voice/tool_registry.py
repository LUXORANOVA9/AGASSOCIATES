from pydantic import BaseModel, Field
from typing import Dict, Any, Callable, List
import logging

logger = logging.getLogger(__name__)

class ToolDefinition(BaseModel):
    name: str
    description: str
    risk: str # low, med, high
    parameters: Dict[str, Any]

class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Callable] = {}
        self.definitions: List[ToolDefinition] = []

    def register(self, name: str, description: str, risk: str, parameters: Dict[str, Any]):
        def decorator(func: Callable):
            self.tools[name] = func
            self.definitions.append(ToolDefinition(
                name=name,
                description=description,
                risk=risk,
                parameters=parameters
            ))
            return func
        return decorator

    def get_tool_schemas(self):
        return [d.dict() for d in self.definitions]

    def get_definition(self, name: str) -> ToolDefinition | None:
        return next((d for d in self.definitions if d.name == name), None)

    def execute(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatch a tool by name. Raises KeyError if the tool isn't registered."""
        if name not in self.tools:
            raise KeyError(f"Unknown tool: {name}")
        try:
            return self.tools[name](**(args or {}))
        except TypeError as exc:
            # Surface bad arg shapes as a structured error rather than a 500.
            return {"error": f"invalid arguments for {name}: {exc}"}

tool_registry = ToolRegistry()

# --- Initial Tools ---

@tool_registry.register(
    name="status_query",
    description="Get the current status of a legal case by its ID",
    risk="low",
    parameters={
        "case_id": {"type": "string", "description": "The unique ID of the case (e.g. MHR-123)"}
    }
)
def status_query(case_id: str):
    # Mock lookup
    return {"case_id": case_id, "status": "Under Review", "next_step": "Stamp Duty Calculation"}

@tool_registry.register(
    name="generate_report",
    description="Generate a performance report for a specific time period",
    risk="low",
    parameters={
        "period": {"type": "string", "enum": ["daily", "weekly", "monthly"], "description": "Report period"}
    }
)
def generate_report(period: str):
    return {"report_url": f"https://s3.luxor9.com/reports/{period}_summary.pdf", "period": period}


@tool_registry.register(
    name="vyasa_legal_opinion",
    description=(
        "Ask Vyasa for a structured legal opinion on an Indian property-law "
        "question. LOW-risk because output is advisory only — no DB writes."
    ),
    risk="low",
    parameters={
        "case_summary": {"type": "string", "description": "Short factual summary of the case"},
        "query": {"type": "string", "description": "The specific legal question to answer"},
    },
)
def vyasa_legal_opinion(case_summary: str, query: str):
    # Lazy import to avoid pulling LangChain into the registry at module load.
    from vyasa_agent import vyasa_agent
    return vyasa_agent.generate_legal_opinion({"summary": case_summary}, query)
