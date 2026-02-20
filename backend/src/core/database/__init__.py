"""SQLAlchemy engine and session (sync)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from core.config import settings


class Base(DeclarativeBase):
    """Base for ORM models."""


engine = create_engine(
    settings.database_direct_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session() -> Session:
    """New session (use as context manager or close after use)."""
    return SessionLocal()
