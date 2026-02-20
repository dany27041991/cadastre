"""SQLAlchemy model for public.districts. Matches 01-init-schema.sql."""

from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry

from core.database import Base


class DistrictModel(Base):
    __tablename__ = "districts"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    municipality_id = Column(Integer, nullable=False)
    code = Column(String(10), nullable=False)
    name = Column(String(255), nullable=False)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
