"""Centralized configuration from environment variables."""
from pathlib import Path

from pydantic import Field, field_validator
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
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip().upper() or "INFO"
        return "INFO"

    # Security (mase-utils-secu): variabile esplicita per abilitare auth; se True servono anche JWT_URI e MASE_API_*
    auth_enabled: bool = Field(default=False, validation_alias="AUTH_ENABLED")
    jwt_uri: str | None = Field(default=None, validation_alias="JWT_URI")

    @field_validator("auth_enabled", mode="before")
    @classmethod
    def parse_auth_enabled(cls, v: object) -> bool:
        """Interpreta AUTH_ENABLED da env: true/1/yes → True, resto (incluso false) → False."""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return False

    iam_alg: str = Field(default="RS256", validation_alias="IAM_ALG")
    jwks_index: int | None = Field(default=None, validation_alias="JWKS_INDEX")

    @field_validator("jwks_index", mode="before")
    @classmethod
    def parse_jwks_index(cls, v: object) -> int | None:
        """Converte JWKS_INDEX da env (stringa) a int; vuoto/mancante → None."""
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return None
            try:
                return int(s)
            except ValueError:
                return None
        return None

    mase_api_authentication: str | None = Field(default=None, validation_alias="MASE_API_AUTHENTICATION")
    mase_api_iam: str | None = Field(default=None, validation_alias="MASE_API_IAM")
    # Solo sviluppo: MASE_SECU_SSL_VERIFY=false disabilita verifica certificati (es. cert scaduto su JWT_URI)
    mase_secu_ssl_verify: bool = Field(default=True, validation_alias="MASE_SECU_SSL_VERIFY")

    @field_validator("mase_secu_ssl_verify", mode="before")
    @classmethod
    def parse_mase_secu_ssl_verify(cls, v: object) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() not in ("false", "0", "no", "off")
        return True

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

    @property
    def auth_middleware_active(self) -> bool:
        """True se auth è abilitata e JWT_URI e MASE_API_AUTHENTICATION sono impostati (middleware secu attivo)."""
        return bool(
            self.auth_enabled
            and self.jwt_uri
            and self.mase_api_authentication
        )


settings = Settings()
