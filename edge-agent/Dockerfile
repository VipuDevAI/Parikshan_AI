FROM python:3.11-slim

LABEL maintainer="SmartGenEduX"
LABEL version="1.0.0"
LABEL description="Parikshan.AI Edge Agent - Local AI Processing for School Surveillance"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY config/ ./config/
COPY detectors/ ./detectors/

ENV PYTHONUNBUFFERED=1
ENV PARIKSHAN_API_URL=https://parikshan.ai
ENV LOG_LEVEL=INFO

RUN mkdir -p /app/data /app/logs /app/queue

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["python", "-m", "src.main"]
