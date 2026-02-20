"""SQLAlchemy model for cadastre.green_areas. Matches 01-init-schema.sql."""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry

from core.database import Base


class GreenAreaModel(Base):
    """ORM entity for cadastre.green_areas."""

    __tablename__ = "green_areas"
    __table_args__ = {"schema": "cadastre"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    municipality_id = Column(Integer, nullable=False)
    province_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(BigInteger, nullable=True)
    level = Column(Integer, nullable=False, default=1)
    region_id = Column(Integer, nullable=False)
    district_id = Column(Integer, nullable=True)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
    meta = Column("metadata", JSONB, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
