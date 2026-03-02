"""
Tree Cadastre - Backend API
FastAPI multi-tenant for geospatial green asset management.
"""
import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from territory import router as territory_router
from core.api import core_router
from core.config import settings

# Set process timezone so datetime.now() and date/time handling use app timezone (e.g. Europe/Rome)
os.environ["TZ"] = settings.app_timezone
if hasattr(time, "tzset"):
    time.tzset()
from core.exceptions import register_exception_handlers
from core.middleware import add_gzip_middleware

app = FastAPI(
    title="Tree Cadastre API",
    description="Multi-tenant GIS API for green asset cadastre",
    version="0.1.0",
)

register_exception_handlers(app)
add_gzip_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(core_router)
app.include_router(territory_router)
