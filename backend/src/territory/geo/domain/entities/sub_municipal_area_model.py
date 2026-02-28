"""SQLAlchemy model for public.sub_municipal_area. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, Integer, SmallInteger, String
from geoalchemy2 import Geometry

from core.database import Base


class SubMunicipalAreaModel(Base):
    """Sub-municipal area (Circoscrizione, Quartiere, Zona Statistica, etc.)."""

    __tablename__ = "sub_municipal_area"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality_id = Column(Integer, nullable=False)
    parent_id = Column(Integer, nullable=True)
    level = Column(SmallInteger, nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    area_type = Column(String(100), nullable=True)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
