"""SQLAlchemy model for public.secondary_types. Matches 01-init-schema-public.sql (DBT catalog)."""

from sqlalchemy import Column, BigInteger, String

from core.database import Base


class SecondaryTypeModel(Base):
    """Secondary type of the DBT object catalog (ts_code 2 chars)."""

    __tablename__ = "secondary_types"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True)
    ts_code = Column(String(2), nullable=False)
    primary_type_id = Column(BigInteger, nullable=False)
    description_code = Column(String(100), nullable=True)
