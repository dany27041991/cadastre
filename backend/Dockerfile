# Tree Cadastre - Backend API (FastAPI)
FROM python:3.12-slim

WORKDIR /app

# System dependencies for PostGIS/geo (+ postgresql-client for init container)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    postgresql-client \
    libexpat1 \
    gcc \
    g++ \
    curl \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    && rm -rf /var/lib/apt/lists/*

# GDAL env vars for Python bindings
ENV GDAL_CONFIG=/usr/bin/gdal-config
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Python dependencies
COPY requirements.txt .
RUN export GDAL_VERSION=$(gdal-config --version) && \
    pip install --no-cache-dir -r requirements.txt

# Application source (src layout)
COPY src ./src
WORKDIR /app/src

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
