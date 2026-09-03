FROM python:3.12-slim

# Include /app in PYTHONPATH so backend can import sibling agent packages
ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirement files first for Docker layer caching
COPY backend/requirements.txt ./backend/
COPY agent/requirements.txt ./agent/

# Install dependencies for both agent and backend
RUN pip install --no-cache-dir -r ./backend/requirements.txt \
    && pip install --no-cache-dir -r ./agent/requirements.txt

# Copy source code directories
COPY agent/ ./agent/
COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]