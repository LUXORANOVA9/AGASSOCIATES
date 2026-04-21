import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = os.getenv("DATABASE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME", "legal_templates_db")
DATABASE_USER = os.getenv("DATABASE_USER", "ag_admin")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "secure_password_123")

# vLLM/LLM Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:8000/v1")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "qwen2.5-7b-instruct")

# Embedding Model Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "384"))

# PDF Generation Configuration
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "/workspace/ag-associates-ai/output")
PDF_ENABLED = os.getenv("PDF_ENABLED", "false").lower() == "true"

# API Configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8001"))

def get_database_url():
    return f"postgresql://{DATABASE_USER}:{DATABASE_PASSWORD}@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}"
