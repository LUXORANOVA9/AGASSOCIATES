from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from config import LLM_MODEL_NAME, LLM_BASE_URL
import logging

logger = logging.getLogger(__name__)

class VyasaAgent:
    """
    Agent 2: Vyasa
    Research and legal opinion agent. Conducts Title Search analysis 
    and precedent research for property transactions.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key="not-needed",
            temperature=0.2
        )
        
    def generate_legal_opinion(self, case_details: Dict[str, Any], query: str) -> Dict[str, Any]:
        """Generate a legal opinion based on case facts and query."""
        logger.info(f"Vyasa researching query for case {case_details.get('case_number', 'UNKNOWN')}")
        
        system_prompt = """You are Vyasa, the Chief Legal Research Agent for AG Associates (a property law firm in Maharashtra, India).
Your expertise spans the Transfer of Property Act (1882), RERA, Maharashtra Stamp Act, and Indian Contract Act.
You must analyze the provided case facts and answer the legal query with a professional legal opinion.

Structure your opinion as:
1. SUMMARY OF FACTS
2. LEGAL ISSUE
3. APPLICABLE LAWS & PRECEDENTS
4. ANALYSIS
5. CONCLUSION & RECOMMENDATION

Do not invent fake case laws. Rely strictly on established Indian property law principles."""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "CASE FACTS:\n{case_details}\n\nLEGAL QUERY:\n{query}")
        ])
        
        chain = prompt | self.llm
        
        try:
            response = chain.invoke({
                "case_details": str(case_details),
                "query": query
            })
            
            return {
                "success": True,
                "opinion": response.content,
                "agent": "Vyasa"
            }
        except Exception as e:
            logger.error(f"Vyasa failed to generate opinion: {e}")
            return {"success": False, "error": str(e)}

# Singleton instance
vyasa_agent = VyasaAgent()
