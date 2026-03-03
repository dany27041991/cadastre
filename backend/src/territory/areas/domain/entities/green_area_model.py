"""SQLAlchemy model for cadastre.green_areas. Aligned with 02-init-schema-cadastre.sql (152-186)."""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry

from core.database import Base


class GreenAreaModel(Base):
    """ORM entity for cadastre.green_areas (ASSET_AREA). Partitioned by region_id."""

    __tablename__ = "green_areas"
    __table_args__ = {"schema": "cadastre"}

    # Primary key (composite for partition compatibility)
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    region_id = Column(Integer, primary_key=True, nullable=False)
    province_id = Column(Integer, primary_key=True, nullable=False)

    municipality_id = Column(Integer, nullable=False)
    level_id = Column(BigInteger, nullable=True)  # FK public.area_level(level_id)
    parent_id = Column(BigInteger, nullable=True)
    name = Column(String(255), nullable=False)
    attribute_type_id = Column(BigInteger, nullable=True)  # FK public.attribute_types(id)
    zril_identifier = Column(String(80), nullable=True)
    susceptibility_classification_area_id = Column(BigInteger, nullable=True)

    # Cadastre ENUMs (stored as strings; DB enforces enum type)
    intensity_of_fruition = Column(String(20), nullable=True)
    geometry_type = Column(String(1), nullable=True)  # cadastre.geometry_type (P/L/S), same enum as green_assets
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    perimeter_type = Column(String(20), nullable=True)
    administrative_status = Column(String(20), nullable=True)
    operational_status = Column(String(30), nullable=True)
    survey_status = Column(String(30), nullable=True)

    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    start_date_of_management = Column(DateTime(timezone=True), nullable=True)
    end_date_of_management = Column(DateTime(timezone=True), nullable=True)
    last_update_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    last_modified_by = Column(String(80), nullable=True)

    attributes = Column(JSONB, nullable=True, server_default=text("'{}'::jsonb"))
    media = Column(JSONB, nullable=True, server_default=text("'[]'::jsonb"))
    note = Column(Text, nullable=True)
    level = Column(Integer, nullable=False, server_default=text("1"))
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
