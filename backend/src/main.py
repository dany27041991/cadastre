"""
Tree Cadastre - Backend API
FastAPI multi-tenant for geospatial green asset management.
Auth (JWT + FGP + IAM) attiva se JWT_URI e MASE_API_AUTHENTICATION sono impostati.
"""
import logging
import os
import ssl
import time

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from territory import router as territory_router
from core.api import core_router
from core.config import settings
from core.logger import setup_logging

setup_logging(log_level=settings.log_level)

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

if settings.auth_middleware_active:
    try:
        if not settings.mase_secu_ssl_verify:
            # Disabilita verifica certificati SSL per chiamate httpx (es. JWKS) – solo sviluppo
            _orig_create_default_context = ssl.create_default_context
            def _no_verify_context(*args: object, **kwargs: object) -> ssl.SSLContext:
                ctx = _orig_create_default_context(*args, **kwargs)
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                return ctx
            ssl.create_default_context = _no_verify_context
            logging.getLogger(__name__).warning(
                "MASE_SECU_SSL_VERIFY=false: verifica certificati SSL disabilitata (solo per sviluppo)."
            )
        from mase_utils_secu import enable_token_authorization
        from mase_utils_secu import TokenAuthConfig

        enable_token_authorization(
            app,
            public_paths=["/health"],  # "/" non supportato da mase-utils-secu (Path matcher cannot be empty)
            config=TokenAuthConfig(
                jwt_uri=settings.jwt_uri,
                iam_alg=settings.iam_alg,
                jwks_index=settings.jwks_index,
                mase_api_authentication=settings.mase_api_authentication,
                mase_api_iam=settings.mase_api_iam,
                allowed_origins=settings.cors_origins_list,
                allowed_methods=["*"],
                allowed_headers=["*"],
            ),
        )
    except ImportError:
        # Standalone build without mase-utils-secu (no Nexus); fall back to CORS-only
        logging.getLogger(__name__).warning(
            "AUTH_ENABLED=true but mase_utils_secu not installed (build without PIP_EXTRA_INDEX_URL). Using CORS-only."
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    except httpx.ConnectError as e:
        logging.getLogger(__name__).warning(
            "Connessione al server auth fallita (es. certificato scaduto). Usando CORS-only. Error: %s",
            e,
        )
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(core_router)
app.include_router(territory_router)
