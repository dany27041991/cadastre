"""SQLAlchemy model for cadastre.asset_green_history. Matches 02-init-schema-cadastre.sql (263-272)."""

from sqlalchemy import Column, Integer, BigInteger
from sqlalchemy.dialects.postgresql import JSONB

from core.database import Base


class AssetGreenHistoryModel(Base):
    """ORM entity for cadastre.asset_green_history (ASSET_GREEN_HISTORY). Partitioned by region_id."""

    __tablename__ = "asset_green_history"
    __table_args__ = {"schema": "cadastre"}

    history_id = Column(BigInteger, primary_key=True, autoincrement=True)
    region_id = Column(Integer, primary_key=True, nullable=False)
    province_id = Column(Integer, primary_key=True, nullable=False)

    asset_green_id = Column(BigInteger, nullable=False)
    municipality_id = Column(Integer, nullable=False)
    sub_municipal_area_id = Column(Integer, nullable=True)
    snapshot = Column(JSONB, nullable=False)
