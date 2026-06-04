"""KARUNA backend — database engine + session factory.

Postgres in production, SQLite for local dev (auto-detected from DATABASE_URL).
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from .config import settings


class Base(DeclarativeBase):
    pass


# SQLite needs check_same_thread=False if used with FastAPI's thread pool.
_connect_args: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    """FastAPI dependency — yields a session and ensures it's closed."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables on startup. Safe to call repeatedly."""
    from . import models  # noqa: F401 — ensure models are imported before create_all
    Base.metadata.create_all(bind=engine)
