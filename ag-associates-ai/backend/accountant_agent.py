import pdfplumber
import re
import json
from typing import Dict, List, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from tenacity import retry, stop_after_attempt, wait_exponential
from config import LLM_MODEL_NAME, LLM_BASE_URL
import logging

logger = logging.getLogger(__name__)

class AccountantAgent:
    """
    Agent 6: Accountant
    Ingests IDBI/other bank statements using pdfplumber.
    Parses UTR numbers, Loan Numbers, and amounts to reconcile data.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=LLM_MODEL_NAME,
            openai_api_base=LLM_BASE_URL,
            openai_api_key="not-needed",
            temperature=0.1
        )
        
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract raw text from bank statement PDF."""
        text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
            return text
        except Exception as e:
            logger.error(f"Failed to read PDF {pdf_path}: {e}")
            raise
            
    def parse_statement_with_llm(self, raw_text: str) -> List[Dict[str, Any]]:
        """Use LLM to structure the extracted bank statement text into transactions."""
        
        system_prompt = """You are an expert financial accountant and data extraction AI for AG Associates.
Your task is to parse raw bank statement text (specifically IDBI and other Indian banks) and extract transaction records.
For each transaction, extract:
- date (YYYY-MM-DD)
- description (raw narration)
- utr_number (Unique Transaction Reference, usually 16-22 chars like 'CMS1234567890' or alphanumeric)
- loan_number (if mentioned in the description)
- amount (float)
- type (CREDIT or DEBIT)

Return ONLY a JSON list of objects. No markdown formatting, no preamble.
Example output format:
[
  {
    "date": "2024-03-15",
    "description": "NEFT-IN CMS1234567890 KOTAK MAHINDRA",
    "utr_number": "CMS1234567890",
    "loan_number": "LOAN987654321",
    "amount": 25000.00,
    "type": "CREDIT"
  }
]"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "Bank Statement Raw Text:\n{raw_text}")
        ])
        
        chain = prompt | self.llm
        
        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
        def invoke_with_retry():
            return chain.invoke({"raw_text": raw_text[:8000]}) # Limit context size
        
        try:
            response = invoke_with_retry()
            # Clean up response to handle potential markdown formatting
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            transactions = json.loads(content.strip())
            return transactions
        except Exception as e:
            logger.error(f"LLM parsing failed: {e}")
            return []

    def reconcile(self, pdf_path: str) -> Dict[str, Any]:
        """Main entry point to process a bank statement and return structured data."""
        logger.info(f"Accountant Agent processing statement: {pdf_path}")
        
        try:
            raw_text = self.extract_text_from_pdf(pdf_path)
            
            if not raw_text.strip():
                return {"success": False, "error": "No text extracted from PDF"}
                
            transactions = self.parse_statement_with_llm(raw_text)
            
            # Additional validation: Filter out empty UTRs or invalid rows
            valid_transactions = []
            for t in transactions:
                # Keep transactions that look like actual transfers with amounts
                if t.get('amount') and t.get('type'):
                    valid_transactions.append(t)
            
            logger.info(f"Successfully extracted {len(valid_transactions)} transactions")
            
            return {
                "success": True,
                "transactions": valid_transactions,
                "summary": {
                    "total_credits": sum(t['amount'] for t in valid_transactions if t.get('type') == 'CREDIT'),
                    "total_debits": sum(t['amount'] for t in valid_transactions if t.get('type') == 'DEBIT'),
                    "transaction_count": len(valid_transactions)
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

# Singleton instance
accountant_agent = AccountantAgent()
