"""Centralized configuration from environment variables."""
from pathlib import Path

from pydantic_settings import BaseSettings

# Project root (parent of backend/); .env in infrastructure/compose/
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_COMPOSE = _PROJECT_ROOT / "infrastructure" / "compose" / ".env"


class Settings(BaseSettings):
    """Settings from environment variables."""

    database_url: str = "postgresql://cadastre:cadastre@pgbouncer:5432/arboreal_green_cadastre"
    database_direct_url: str = "postgresql://cadastre:cadastre@postgis:5432/arboreal_green_cadastre"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:5173"
    app_env: str = "development"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = (str(_ENV_COMPOSE), ".env") if _ENV_COMPOSE.exists() else ".env"
        extra = "ignore"


settings = Settings()
