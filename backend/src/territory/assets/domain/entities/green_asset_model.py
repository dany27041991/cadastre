"""SQLAlchemy model for cadastre.green_assets. Matches 01-init-schema.sql."""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry

from core.database import Base


class GreenAssetModel(Base):
    """ORM entity for cadastre.green_assets."""

    __tablename__ = "green_assets"
    __table_args__ = {"schema": "cadastre"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    municipality_id = Column(Integer, nullable=False)
    province_id = Column(Integer, nullable=False)
    asset_type = Column(String(50), nullable=False)  # cadastre.asset_type enum
    geometry_type = Column(String(50), nullable=False)  # cadastre.geometry_type enum
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False)
    green_area_id = Column(BigInteger, nullable=True)
    region_id = Column(Integer, nullable=False)
    district_id = Column(Integer, nullable=True)
    species = Column(String(255), nullable=True)
    attributes = Column(JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
