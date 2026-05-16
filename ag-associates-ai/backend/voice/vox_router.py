from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from config import LLM_MODEL_NAME, LLM_BASE_URL
from .tool_registry import tool_registry
import logging
import json

logger = logging.getLogger(__name__)

class VoxRouter:
    """Uses LLM to route transcribed voice commands to specific tools."""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key="not-needed",
            temperature=0
        )
        self.parser = JsonOutputParser()

    def route(self, transcript: str) -> dict:
        tools = tool_registry.get_tool_schemas()
        
        system_prompt = """You are Vyasa's Voice Router. Your job is to analyze a voice command transcript and map it to exactly ONE tool from the provided registry.
        
        TOOLS AVAILABLE:
        {tools_json}
        
        Rules:
        1. Output ONLY a JSON object with 'tool', 'args', and 'reasoning'.
        2. If no tool matches, set tool to 'null'.
        3. Extract arguments (like case_id) carefully from the transcript.
        
        Example Output:
        {{
            "tool": "status_query",
            "args": {{"case_id": "MHR-123"}},
            "reasoning": "User asked for the status of a specific case ID mentioned in the audio."
        }}"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "TRANSCRIPT: {transcript}")
        ])
        
        chain = prompt | self.llm | self.parser
        
        try:
            result = chain.invoke({
                "tools_json": json.dumps(tools, indent=2),
                "transcript": transcript
            })
            return result
        except Exception as e:
            logger.error(f"VoxRouter failed: {e}")
            return {"tool": None, "error": str(e)}

vox_router = VoxRouter()
