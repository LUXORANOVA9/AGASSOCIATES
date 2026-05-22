# Stage 1: Build
FROM python:3.11-slim-bookworm AS builder
WORKDIR /app
ENV PATH=/root/.local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends gcc libpq-dev \
 && rm -rf /var/lib/apt/lists/*
COPY requirements.prod.txt .
RUN pip install --user --no-cache-dir -r requirements.prod.txt
# Pre-download Playwright Chromium for RPA automation (GRAS/IGR portals)
RUN python -m playwright install chromium

# Stage 2: Runtime
FROM python:3.11-slim-bookworm
WORKDIR /app

# Non-root runtime user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# System deps: runtime libs + Playwright browser dependencies
RUN apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends \
    libpq5 curl ca-certificates \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxfixes3 \
 && rm -rf /var/lib/apt/lists/*

# Bring installed deps + Playwright browsers from builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --from=builder --chown=appuser:appuser /opt/ms-playwright /opt/ms-playwright

ENV PATH=/home/appuser/.local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    UVICORN_WORKERS=4 \
    OUTPUT_DIR=/app/output \
    REDIS_URL=${REDIS_URL:-redis://redis:6379}

# Application code
COPY --chown=appuser:appuser . .
RUN mkdir -p /app/output /app/temp_audio && chown -R appuser:appuser /app/output /app/temp_audio

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-4}"]
