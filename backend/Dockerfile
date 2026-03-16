# Tree Cadastre - Backend API (FastAPI)
# Build produzione: stessa base e pipeline Black Duck di cu1.5-models-MVP3-local.
FROM crpsndxcdpvil01.azurecr.io/python/python-java-dxc:latest

WORKDIR /app

COPY . /app

# Dipendenze di sistema per PostGIS (psycopg2, Shapely). GDAL commentata: non usata dal backend.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    postgresql-client \
    libexpat1 \
    gcc \
    g++ \
    curl \
#    gdal-bin \
#    libgdal-dev \
#    python3-gdal \
    && rm -rf /var/lib/apt/lists/*

# ENV GDAL_CONFIG=/usr/bin/gdal-config
# ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
# ENV C_INCLUDE_PATH=/usr/include/gdal

# Black Duck (Synopsys): SCA su dipendenze Python (CVE, licenze). Richiede BLACKDUCK_URL e BLACKDUCK_TOKEN in build.
RUN pip install -r ./requirements.txt \
    && /blackduck/detect.sh \
#    --blackduck.url=$BLACKDUCK_URL \
#    --blackduck.api.token=$BLACKDUCK_TOKEN \
    --detect.project.name=linfa-cadastre-backend \
    --detect.project.version.name=0.1.0 \
    --detect.project.version.update=true \
    --detect.code.location.unmap=true \
    --detect.python.python.path=/usr/bin/python3 \
    --detect.pip.requirements.path=./requirements.txt

WORKDIR /app/src
EXPOSE 8000 5678
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
