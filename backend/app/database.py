from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import database_url


class Base(DeclarativeBase):
    pass


def get_engine() -> Engine:
    url = database_url()
    return create_engine(url, connect_args={"check_same_thread": False})


def init_db(engine: Engine) -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_owner_column(engine)


def _ensure_owner_column(engine: Engine) -> None:
    with engine.begin() as connection:
        rows = connection.execute(text("PRAGMA table_info(tasks)")).fetchall()
        columns = {row[1] for row in rows}
        if columns and "owner_id" not in columns:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN owner_id INTEGER"))


def get_db(request: Request) -> Generator[Session, None, None]:
    session = request.app.state.SessionLocal()
    try:
        yield session
    finally:
        session.close()
