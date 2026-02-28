"""SQLAlchemy model for public.census_section. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry

from core.database import Base


class CensusSectionModel(Base):
    """Census section or locality (sezione di censimento, località). Source: sections.geojson."""

    __tablename__ = "census_section"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality_id = Column(Integer, nullable=False)
    code = Column(String(50), nullable=True)
    name = Column(String(255), nullable=False)
    layer_type = Column(String(20), nullable=False)  # public.census_layer_type enum
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
