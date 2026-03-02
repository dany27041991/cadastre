"""Load and serve translations by locale."""

from pathlib import Path

# Translations dir next to this package
_LOCALES_DIR = Path(__file__).resolve().parent / "locales"
_CACHE: dict[str, dict[str, str]] = {}


def _load_locale(locale: str) -> dict[str, str]:
    """Load JSON translations for a locale; cache in memory."""
    if locale in _CACHE:
        return _CACHE[locale]
    import json

    path = _LOCALES_DIR / f"{locale}.json"
    if not path.exists():
        return _CACHE.setdefault(locale, {})
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    flat = _flatten_dict(data, prefix="")
    _CACHE[locale] = flat
    return flat


def _flatten_dict(d: dict, prefix: str) -> dict[str, str]:
    """Flatten nested dict to dot keys (e.g. errors.not_found)."""
    out: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten_dict(v, f"{key}."))
        else:
            out[key] = str(v)
    return out


def get_translator(locale: str):
    """
    Return a translator callable for the given locale.
    Usage: t("errors.not_found") or t("errors.with_arg", name="Region").
    """

    def t(key: str, default: str | None = None, **params: str) -> str:
        return translate(key, locale, default=default, **params)

    return t


def translate(key: str, locale: str, default: str | None = None, **params: str) -> str:
    """
    Translate a message key for the given locale.
    Keys use dot notation (e.g. errors.not_found).
    Placeholders in the message use {name}; pass kwargs to fill them.
    Falls back to default locale then to key if missing.
    """
    messages = _load_locale(locale)
    msg = messages.get(key)
    if msg is None and locale != "en":
        messages = _load_locale("en")
        msg = messages.get(key)
    if msg is None:
        return default or key
    try:
        return msg.format(**params) if params else msg
    except KeyError:
        return msg
