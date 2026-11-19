from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User, get_current_user
from app.database import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskRead, TaskUpdate

tasks_router = APIRouter()


@tasks_router.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    statement = (
        select(Task)
        .where((Task.owner_id.is_(None)) | (Task.owner_id == user.id))
        .order_by(Task.created_at.desc(), Task.id.desc())
    )
    return list(db.scalars(statement).all())


@tasks_router.post("/tasks", response_model=TaskRead, status_code=201)
def create_task(
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    now = datetime.now(timezone.utc)
    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status.value,
        created_at=now,
        updated_at=now,
        owner_id=user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@tasks_router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task_status(
    task_id: Annotated[int, Path(ge=1)],
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = _owned_task(db, user, task_id)
    task.status = payload.status.value
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


@tasks_router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: Annotated[int, Path(ge=1)],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    task = _owned_task(db, user, task_id)
    db.delete(task)
    db.commit()
    return Response(status_code=204)


def _owned_task(db: Session, user: User, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if task is None or (task.owner_id is not None and task.owner_id != user.id):
        raise HTTPException(status_code=404, detail="Task not found")
    return task
