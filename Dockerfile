# ---- Stage 1: build frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + serve ----
FROM python:3.11-slim
WORKDIR /app

# Install torch CPU-only (much smaller than full torch)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist ../frontend/dist

# Data dir for SQLite (mount as volume for persistence)
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "python seed.py 2>/dev/null; uvicorn main:app --host 0.0.0.0 --port 8000"]
