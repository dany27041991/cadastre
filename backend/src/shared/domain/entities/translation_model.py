"""SQLAlchemy model for public.translations. Matches 01-init-schema-public.sql."""

from sqlalchemy import Column, BigInteger, String, Text, UniqueConstraint

from core.database import Base


class TranslationModel(Base):
    """Localized text for tables and enums. column_name: for TABLE, the column/slot; NULL for single-slot or ENUM."""

    __tablename__ = "translations"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_name", "key", "lang", "column_name",
            name="uq_translations_entity_type_name_key_lang_column",
        ),
        {"schema": "public"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)
    entity_name = Column(String(100), nullable=False)
    key = Column(String(255), nullable=False)
    column_name = Column(String(100), nullable=True)
    lang = Column(String(2), nullable=False)
    translation = Column(Text, nullable=True)
