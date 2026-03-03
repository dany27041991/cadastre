"""SQLAlchemy model for cadastre.green_assets. Aligned with 02-init-schema-cadastre.sql (211-255)."""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry

from core.database import Base


class GreenAssetModel(Base):
    """ORM entity for cadastre.green_assets (ASSET_GREEN). Partitioned by region_id."""

    __tablename__ = "green_assets"
    __table_args__ = {"schema": "cadastre"}

    # Primary key (composite for partition compatibility)
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    region_id = Column(Integer, primary_key=True, nullable=False)
    province_id = Column(Integer, primary_key=True, nullable=False)

    green_area_id = Column(BigInteger, nullable=True)
    municipality_id = Column(Integer, nullable=False)
    attribute_type_id = Column(BigInteger, nullable=True)  # FK public.attribute_types(id)

    asset_type = Column(String(30), nullable=False, server_default=text("'other'"))  # cadastre.asset_type enum
    geometry_type = Column(String(20), nullable=False)  # cadastre.geometry_type enum
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False)

    family = Column(String(80), nullable=True)
    genus = Column(String(50), nullable=True)
    species = Column(String(50), nullable=True)
    variety = Column(String(50), nullable=True)
    attributes = Column(JSONB, nullable=True, server_default=text("'{}'::jsonb"))

    start_date_of_management = Column(DateTime(timezone=True), nullable=True)
    end_date_of_management = Column(DateTime(timezone=True), nullable=True)
    planting_date = Column(DateTime(timezone=True), nullable=True)
    last_update_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Cadastre ENUMs (stored as strings; DB enforces enum type)
    health_status = Column(String(20), nullable=True)
    stability_status = Column(String(30), nullable=True)
    structural_defect = Column(String(20), nullable=True)
    risk_level = Column(String(20), nullable=True)
    maintenance_priority = Column(String(20), nullable=True)
    intervention_type = Column(String(20), nullable=True)
    growth_stage = Column(String(20), nullable=True)
    origin = Column(String(20), nullable=True)
    protection_status = Column(String(20), nullable=True)
    asset_status = Column(String(35), nullable=True)
    monitoring_required = Column(String(20), nullable=True)
    next_inspection_date = Column(DateTime(timezone=True), nullable=True)
    priority_level_evaluation = Column(String(20), nullable=True)

    managing_entity = Column(String(120), nullable=True)
    last_modified_by = Column(String(80), nullable=True)
    survey_date = Column(DateTime(timezone=True), nullable=True)
    survey_method = Column(String(120), nullable=True)

    media = Column(JSONB, nullable=True, server_default=text("'[]'::jsonb"))
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
