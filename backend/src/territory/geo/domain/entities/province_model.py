"""SQLAlchemy model for public.provinces. Matches 01-init-schema.sql."""

from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry

from core.database import Base


class ProvinceModel(Base):
    __tablename__ = "provinces"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(3), nullable=False)
    name = Column(String(100), nullable=False)
    vehicle_registration_code = Column(String(2), nullable=False)
    region_id = Column(Integer, nullable=False)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
