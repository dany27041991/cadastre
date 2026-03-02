"""App timezone (Europe/Rome by default); use for consistent date/time in the API."""

from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings

_APP_TZ: ZoneInfo | None = None


def get_app_tz() -> ZoneInfo:
    """Return the app timezone (e.g. Europe/Rome). Use for timezone-aware datetimes."""
    global _APP_TZ
    if _APP_TZ is None:
        _APP_TZ = ZoneInfo(settings.app_timezone)
    return _APP_TZ


def now_app() -> datetime:
    """Current UTC time converted to app timezone (Rome). Timezone-aware."""
    return datetime.now(get_app_tz())
