"""Postgres + pgvector helpers shared across the pipeline nodes."""

from typing import Any, Dict, List

import psycopg2
from pgvector.psycopg2 import register_vector
from psycopg2.extras import RealDictCursor

from config import EMBEDDING_MODEL_NAME, EMBEDDING_DIMENSION, get_database_url

import logging
logger = logging.getLogger(__name__)


def get_db_connection():
    """Create a connection with pgvector registered. Caller closes."""
    conn = psycopg2.connect(get_database_url(), cursor_factory=RealDictCursor)
    register_vector(conn)
    return conn


# Lazy-loaded SentenceTransformer — initialised on first call to avoid
# import-time overhead and to keep startup fast when the backend is used
# without any RAG queries (e.g. health checks).
_embedding_model = None


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        except ImportError:
            logger.warning(
                "sentence-transformers not installed; RAG disabled. "
                "Install it for vector similarity search."
            )
            _embedding_model = False
    return _embedding_model if _embedding_model is not False else None


def generate_embedding(text: str) -> List[float]:
    """Generate a vector embedding. Returns zero vector if model unavailable."""
    model = _get_embedding_model()
    if model is None:
        return [0.0] * EMBEDDING_DIMENSION
    embedding = model.encode(text)
    return embedding.tolist()


def similarity_search(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Vector similarity search across legal_templates."""
    query_embedding = generate_embedding(query)

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT id, title, content, language, jurisdiction,
                       1 - (embedding <=> %s::vector) as similarity
                FROM legal_templates
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_embedding, query_embedding, limit),
            )
            results = cur.fetchall()
        finally:
            cur.close()
    finally:
        conn.close()

    return [dict(row) for row in results]
