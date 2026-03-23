# ============================================================
# Combined Dockerfile: Node.js backend + Python AI server
# Uses supervisord to run both processes in a single container
# ============================================================

# --- Base image with both Node.js and Python ---
FROM node:20-slim

# Install Python 3.11, pip, and supervisord
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        supervisor && \
    rm -rf /var/lib/apt/lists/*

# ============================================================
# 1. Install Python dependencies (python-server)
# ============================================================
WORKDIR /app/python-server

COPY python-server/requirements.txt .
RUN python3 -m venv /app/python-server/.venv && \
    /app/python-server/.venv/bin/pip install --no-cache-dir -r requirements.txt

COPY python-server/ .

# ============================================================
# 2. Install Node.js dependencies (backend)
# ============================================================
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .

# ============================================================
# 3. Setup supervisord
# ============================================================
WORKDIR /app

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# The Node backend will listen on $PORT (set by Render)
# The Python server will listen on port 5001 internally
ENV AI_SERVICE_URL=http://localhost:5001

# Start supervisord (manages both processes)
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
