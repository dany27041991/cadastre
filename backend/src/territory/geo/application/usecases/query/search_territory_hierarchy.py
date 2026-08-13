"""Use case: search territory hierarchy (admin + green areas)."""

from territory.geo.infrastructure.repository.territory_search_repository import (
    TerritorySearchRepository,
)


class SearchTerritoryHierarchy:
    def __init__(self, repo: TerritorySearchRepository) -> None:
        self._repo = repo

    def search(self, q: str = "", limit: int = 20) -> list[dict]:
        return self._repo.search(q=q, limit=limit)
