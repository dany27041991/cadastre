"""SQLAlchemy model for public.area_level. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, BigInteger, Integer, String

from core.database import Base


class AreaLevelModel(Base):
    """Abstract hierarchical level of the green asset system (MANAGEMENT_UNIT, etc.)."""

    __tablename__ = "area_level"
    __table_args__ = {"schema": "public"}

    level_id = Column(BigInteger, primary_key=True)
    level_name = Column(String(100), nullable=False)
    hierarchy_order = Column(Integer, nullable=False)
    description_code = Column(String(100), nullable=True)
