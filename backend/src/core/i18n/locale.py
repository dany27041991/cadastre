"""Locale resolution from request headers (Accept-Language, X-Locale)."""

from fastapi import Request

from core.config import settings

# Supported locales; first is default
SUPPORTED_LOCALES = ("en", "it")
DEFAULT_LOCALE = getattr(settings, "default_locale", "en") or "en"


def resolve_locale(accept_language: str | None, x_locale: str | None = None) -> str:
    """
    Resolve locale from Accept-Language or X-Locale.
    X-Locale takes precedence if present and supported.
    """
    if x_locale and x_locale.lower() in SUPPORTED_LOCALES:
        return x_locale.lower()
    if accept_language:
        # Parse first preferred language (e.g. "it-IT,it;q=0.9,en;q=0.8" -> "it")
        for part in accept_language.split(","):
            lang = part.split(";")[0].strip().split("-")[0].lower()
            if lang in SUPPORTED_LOCALES:
                return lang
    return DEFAULT_LOCALE


def get_locale_from_request(request: Request) -> str:
    """Extract locale from FastAPI request (X-Locale or Accept-Language)."""
    x_locale = request.headers.get("X-Locale")
    accept_language = request.headers.get("Accept-Language")
    return resolve_locale(accept_language, x_locale)
