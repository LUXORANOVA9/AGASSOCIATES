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

def _noi_status(case_id: str):
    """Check NOI status for a case. Routes through NOIAgent."""
    import asyncio
    from noi_agent import noi_agent
    loop = asyncio.new_event_loop()
    try:
        case = loop.run_until_complete(noi_agent.get_case(case_id))
        return case or {"error": f"Case {case_id} not found"}
    finally:
        loop.close()


def _generate_challan(case_id: str):
    """Generate NOI challan via GRAS RPA."""
    import asyncio
    from noi_agent import noi_agent
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(noi_agent.generate_challan(case_id))
        return result
    finally:
        loop.close()


def _file_noi(case_id: str):
    """File NOI on IGR portal via RPA."""
    import asyncio
    from noi_agent import noi_agent
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(noi_agent.file_noi(case_id))
        return result
    finally:
        loop.close()


def _verify_noi_docs(case_id: str):
    """Verify documents for NOI case."""
    import asyncio
    from noi_agent import noi_agent
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(noi_agent.verify_documents(case_id))
        return result
    finally:
        loop.close()


tool_registry = ToolRegistry()

# --- NOI Workflow Tools ---

@tool_registry.register(
    name="noi_status",
    description="Get the current NOI workflow status for a case (CHALLAN_GENERATED, FILED, ACKNOWLEDGED, etc.)",
    risk="low",
    parameters={
        "case_id": {"type": "string", "description": "The case ID (e.g. MHR-123 or UUID)"}
    }
)
def noi_status_tool(case_id: str):
    return _noi_status(case_id)

@tool_registry.register(
    name="generate_noi_challan",
    description="Generate an NOI stamp duty challan on the GRAS portal (0.3% of loan amount under Article 61)",
    risk="high",
    parameters={
        "case_id": {"type": "string", "description": "The case ID"}
    }
)
def generate_noi_challan_tool(case_id: str):
    return _generate_challan(case_id)

@tool_registry.register(
    name="file_noi",
    description="File a Notice of Intimation on the IGR e-filing portal (requires GRN from challan)",
    risk="high",
    parameters={
        "case_id": {"type": "string", "description": "The case ID"}
    }
)
def file_noi_tool(case_id: str):
    return _file_noi(case_id)

@tool_registry.register(
    name="verify_noi_documents",
    description="Check that all required NOI documents (sanction letter, KYC, property docs, stamp duty receipt) are present",
    risk="low",
    parameters={
        "case_id": {"type": "string", "description": "The case ID"}
    }
)
def verify_noi_docs_tool(case_id: str):
    return _verify_noi_docs(case_id)

# --- Existing Tools ---

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
