FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Scanpy
RUN apt-get update && apt-get install -y \
    gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY backend /app/backend/

# Hugging Face Spaces exposes port 7860
EXPOSE 7860

# Start FastAPI on port 7860
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
