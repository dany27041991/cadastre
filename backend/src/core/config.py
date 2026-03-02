"""Centralized configuration from environment variables."""
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root (parent of backend/); when present, load infrastructure/compose/.env for local runs.
# In Docker Compose, env vars are injected by compose from that .env, so env_file is optional.
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_ENV_COMPOSE = _REPO_ROOT / "infrastructure" / "compose" / ".env"


class Settings(BaseSettings):
    """Settings from environment variables (see infrastructure/compose/.env)."""

    model_config = SettingsConfigDict(
        env_file=(str(_ENV_COMPOSE), ".env") if _ENV_COMPOSE.exists() else ".env",
        extra="ignore",
    )

    postgres_host: str = Field(default="localhost", validation_alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, validation_alias="POSTGRES_PORT")
    postgres_user: str = Field(default="cadastre", validation_alias="POSTGRES_USER")
    postgres_password: str = Field(default="cadastre", validation_alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="arboreal_green_cadastre", validation_alias="POSTGRES_DB")
    cors_origins: str = Field(default="http://localhost:5173", validation_alias="CORS_ORIGINS")
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_timezone: str = Field(default="Europe/Rome", validation_alias="APP_TIMEZONE")
    # Cache for administrative areas (regions, provinces, municipalities, sub-municipal); daily expiry
    admin_areas_cache_ttl_seconds: int = Field(
        default=86400, validation_alias="ADMIN_AREAS_CACHE_TTL_SECONDS"
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_direct_url(self) -> str:
        return self.database_url

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
