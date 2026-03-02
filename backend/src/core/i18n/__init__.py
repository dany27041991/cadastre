"""Internationalization: locale resolution and message translation."""

from core.i18n.translator import get_translator, translate
from core.i18n.locale import get_locale_from_request, resolve_locale

__all__ = [
    "get_translator",
    "translate",
    "get_locale_from_request",
    "resolve_locale",
]
