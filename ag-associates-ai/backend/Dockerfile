# Stage 1: Build
FROM python:3.11-slim-bookworm AS builder
WORKDIR /app
ENV HF_HOME=/opt/hf-cache \
    SENTENCE_TRANSFORMERS_HOME=/opt/hf-cache \
    PATH=/root/.local/bin:$PATH
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt
# Pre-download the SentenceTransformer model so first /api/generate-agreement
# does not stall on a multi-hundred-MB HF download.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Stage 2: Runtime
FROM python:3.11-slim-bookworm
WORKDIR /app

# Non-root runtime user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends libpq5 curl \
 && rm -rf /var/lib/apt/lists/*

# Bring installed deps + pre-warmed HF cache over from the builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --from=builder --chown=appuser:appuser /opt/hf-cache /opt/hf-cache
ENV PATH=/home/appuser/.local/bin:$PATH \
    HF_HOME=/opt/hf-cache \
    SENTENCE_TRANSFORMERS_HOME=/opt/hf-cache \
    UVICORN_WORKERS=4 \
    OUTPUT_DIR=/app/output

# Application code
COPY --chown=appuser:appuser . .
RUN mkdir -p /app/output && chown -R appuser:appuser /app/output

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}"]
