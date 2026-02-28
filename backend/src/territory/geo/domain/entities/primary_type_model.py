"""SQLAlchemy model for public.primary_types. Matches 01-init-schema-public.sql (DBT catalog)."""

from sqlalchemy import Column, BigInteger, String

from core.database import Base


class PrimaryTypeModel(Base):
    """Primary type of the DBT object catalog (tp_code 1 char)."""

    __tablename__ = "primary_types"
    __table_args__ = {"schema": "public"}

    id = Column(BigInteger, primary_key=True)
    tp_code = Column(String(1), nullable=False)
    description_code = Column(String(100), nullable=True)
