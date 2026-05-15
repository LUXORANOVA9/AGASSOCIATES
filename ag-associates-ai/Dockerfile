FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY database/ ./database/

# Create output directory for generated documents
RUN mkdir -p /app/output

ENV OUTPUT_DIR=/app/output
ENV API_HOST=0.0.0.0
ENV API_PORT=8001

EXPOSE 8001

WORKDIR /app/backend

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
