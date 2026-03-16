"""Use case factories and auth dependencies for route handlers."""

from typing import Any

from core.api.container import (
    get_regions_use_case,
    get_provinces_by_region_use_case,
    get_municipalities_by_province_use_case,
    get_sub_municipal_areas_by_municipality_use_case,
    get_green_areas_use_case,
    get_green_assets_use_case,
)

try:
    from mase_utils_secu.types import (
        CurrentUser,
        OptionalCurrentUser,
        Authorized,
        get_current_user,
        get_authorization,
        pre_authorize,
    )
except ImportError:
    # Standalone build without Nexus: mase-utils-secu not installed. Use AUTH_ENABLED=false.
    from fastapi import Depends
    from fastapi import HTTPException

    def _auth_unavailable() -> None:
        raise HTTPException(
            503,
            "Authentication not available (mase-utils-secu not installed). "
            "Set AUTH_ENABLED=false or build with PIP_EXTRA_INDEX_URL.",
        )

    async def get_current_user() -> None:
        _auth_unavailable()

    async def get_authorization() -> None:
        _auth_unavailable()

    def pre_authorize(required_authorities: list[str]) -> list[Any]:
        return [Depends(_auth_unavailable)]

    CurrentUser = Any  # type alias when secu not installed
    OptionalCurrentUser = Any
    Authorized = Any

get_regions_uc = get_regions_use_case
get_provinces_uc = get_provinces_by_region_use_case
get_municipalities_uc = get_municipalities_by_province_use_case
get_sub_municipal_areas_uc = get_sub_municipal_areas_by_municipality_use_case
get_green_areas_uc = get_green_areas_use_case
get_green_assets_uc = get_green_assets_use_case
