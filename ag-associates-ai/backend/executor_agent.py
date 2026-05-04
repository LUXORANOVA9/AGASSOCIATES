from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
from config import LLM_MODEL_NAME, LLM_BASE_URL
import logging

logger = logging.getLogger(__name__)

class ExecutorAgent:
    """
    Agent 4: Executor
    Workflow manager agent. Handles SLA tracking, system actions, 
    and determines which field executive to assign based on the case.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key="not-needed",
            temperature=0.0
        )
        
    def determine_next_action(self, case_state: Dict[str, Any]) -> Dict[str, Any]:
        """Determine the next workflow action based on current case state."""
        logger.info(f"Executor evaluating state for case {case_state.get('case_number', 'UNKNOWN')}")
        
        system_prompt = """You are the Executor Agent for AG Associates.
Your job is to read the current state of a legal case and determine the exact next workflow action.
You must return a raw JSON object with no markdown formatting.

You can choose from the following actions:
- 'ASSIGN_FIELD_EXEC' (if documents need to be collected or registered)
- 'TRIGGER_DRAFTER' (if facts are gathered but documents aren't drafted)
- 'SEND_CLIENT_UPDATE' (if a milestone is reached)
- 'ESCALATE_SLA' (if the deadline is within 24 hours and not complete)

JSON Format:
{
  "action": "ACTION_NAME",
  "reason": "Brief explanation",
  "assignee_role": "Advocate/Field Exec/None",
  "urgency": "High/Medium/Low"
}"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "CASE STATE:\n{case_state}")
        ])
        
        chain = prompt | self.llm
        
        try:
            response = chain.invoke({"case_state": str(case_state)})
            content = response.content.strip()
            
            # Clean JSON
            if content.startswith("```json"): content = content[7:]
            if content.startswith("```"): content = content[3:]
            if content.endswith("```"): content = content[:-3]
                
            decision = json.loads(content.strip())
            return {
                "success": True,
                "decision": decision,
                "agent": "Executor"
            }
        except Exception as e:
            logger.error(f"Executor failed to determine action: {e}")
            return {"success": False, "error": str(e)}

# Singleton instance
executor_agent = ExecutorAgent()
