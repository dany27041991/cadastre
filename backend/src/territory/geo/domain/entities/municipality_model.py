"""SQLAlchemy model for public.municipalities. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, Integer, String, Boolean
from geoalchemy2 import Geometry

from core.database import Base


class MunicipalityModel(Base):
    __tablename__ = "municipalities"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    istat_code = Column(String(6), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    province_id = Column(Integer, nullable=False)
    is_provincial_capital = Column(Boolean, nullable=True, default=False)
    geometry = Column(Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True)
