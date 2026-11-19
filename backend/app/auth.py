import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import auth_password_hash, auth_username, session_secret
from app.database import get_db
from app.models import SINGLE_USER_ID, AuthSession

COOKIE_NAME = "task_session"
SESSION_TTL_SECONDS = 43200
_HASH_RE = re.compile(r"^pbkdf2_sha256\$200000\$([0-9a-fA-F]+)\$([0-9a-fA-F]+)$")


@dataclass(frozen=True)
class User:
    id: int
    username: str


def auth_configured() -> bool:
    username = auth_username()
    encoded = auth_password_hash()
    return bool(username) and encoded is not None and _HASH_RE.fullmatch(encoded) is not None and session_secret() is not None


def verify_password(password: str, encoded: str) -> bool:
    match = _HASH_RE.fullmatch(encoded)
    if match is None:
        return False
    salt = bytes.fromhex(match.group(1))
    expected = bytes.fromhex(match.group(2))
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200000)
    if len(derived) != len(expected):
        return False
    return hmac.compare_digest(derived, expected)


def credentials_match(username: str, password: str) -> bool:
    expected_username = auth_username() or ""
    encoded = auth_password_hash() or ""
    username_ok = _same_text(username, expected_username)
    password_ok = verify_password(password, encoded)
    return username_ok and password_ok


def issue_session(db: Session) -> str:
    key = session_secret()
    if key is None or not auth_configured():
        raise HTTPException(status_code=503, detail="Auth is not configured")
    token = hmac.new(key.encode(), secrets.token_bytes(32), hashlib.sha256).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    db.add(AuthSession(secret=token, expires_at=expires_at))
    db.commit()
    return token


def revoke_session(db: Session, token: str | None) -> None:
    if not token:
        return
    row = db.scalar(select(AuthSession).where(AuthSession.secret == token))
    if row is None:
        return
    db.delete(row)
    db.commit()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    username = auth_username()
    token = request.cookies.get(COOKIE_NAME)
    if not auth_configured() or username is None or not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    row = db.scalar(select(AuthSession).where(AuthSession.secret == token))
    if row is None or _expired(row.expires_at):
        if row is not None:
            db.delete(row)
            db.commit()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return User(id=SINGLE_USER_ID, username=username)


def _same_text(left: str, right: str) -> bool:
    left_bytes = left.encode()
    right_bytes = right.encode()
    if len(left_bytes) != len(right_bytes):
        return False
    return hmac.compare_digest(left_bytes, right_bytes)


def _expired(value: datetime | str) -> bool:
    parsed = _as_utc(value)
    return parsed <= datetime.now(timezone.utc)


def _as_utc(value: datetime | str) -> datetime:
    if isinstance(value, str):
        text = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
    else:
        parsed = value
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
