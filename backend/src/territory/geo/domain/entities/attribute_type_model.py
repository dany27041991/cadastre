"""SQLAlchemy model for public.attribute_types. Matches 01-init-schema-public.sql (DBT catalog)."""

from sqlalchemy import Column, BigInteger, String, UniqueConstraint

from core.database import Base


class AttributeTypeModel(Base):
    """Attribute type of the DBT object catalog (ts_code 3 chars). Full code = geom_type + tp + ts + attribute ts_code (7 chars)."""

    __tablename__ = "attribute_types"
    __table_args__ = (
        UniqueConstraint("secondary_type_id", "ts_code", "geom_type", name="uq_attribute_types_secondary_ts_geom"),
        {"schema": "public"},
    )

    id = Column(BigInteger, primary_key=True)
    ts_code = Column(String(3), nullable=False)
    secondary_type_id = Column(BigInteger, nullable=False)
    geom_type = Column(String(1), nullable=False)  # public.geom_type enum ('P', 'L', 'S')
    description_code = Column(String(100), nullable=True)
