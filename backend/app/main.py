from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.config import cors_origins
from app.database import get_engine, init_db
from app.routers.tasks import tasks_router


def health() -> dict[str, str]:
    return {"status": "ok"}


def create_app() -> FastAPI:
    engine = get_engine()
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db(engine)
        yield
        engine.dispose()

    application = FastAPI(lifespan=lifespan)
    application.state.engine = engine
    application.state.SessionLocal = SessionLocal
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    application.include_router(tasks_router, prefix="/api")
    application.add_api_route("/api/health", health, methods=["GET"])
    return application


app = create_app()
