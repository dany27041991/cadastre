"""SQLAlchemy model for public.regions. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry

from core.database import Base


class RegionModel(Base):
    __tablename__ = "regions"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(10), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
