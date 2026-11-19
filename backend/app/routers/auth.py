from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.auth import (
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    User,
    auth_configured,
    credentials_match,
    get_current_user,
    issue_session,
    revoke_session,
)
from app.config import cookie_secure
from app.database import get_db

auth_router = APIRouter()


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)

    @field_validator("username", "password", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


@auth_router.post("/login", status_code=204)
def login(payload: LoginBody, db: Session = Depends(get_db)) -> Response:
    if not auth_configured():
        raise HTTPException(status_code=503, detail="Auth is not configured")
    if not credentials_match(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = issue_session(db)
    response = Response(status_code=204)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        path="/",
        samesite="lax",
        secure=cookie_secure(),
    )
    return response


@auth_router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db)) -> Response:
    revoke_session(db, request.cookies.get(COOKIE_NAME))
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/", samesite="lax")
    return response


@auth_router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"username": user.username}
