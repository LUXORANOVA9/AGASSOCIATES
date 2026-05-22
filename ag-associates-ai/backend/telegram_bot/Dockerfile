FROM python:3.12-slim-bookworm
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

ENV TELEGRAM_BOT_PORT=3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3003/health || exit 1

CMD ["python", "bot.py"]
