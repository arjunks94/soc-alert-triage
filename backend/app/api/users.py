from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, require_role
from app.database.session import get_db
from app.models.models import User
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate
from app.utils.helpers import create_audit_log

router = APIRouter(prefix="/users", tags=["Users"])


class PasswordResetBody(BaseModel):
    password: str = Field(min_length=8, max_length=128)


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_MANAGER")),
):
    result = await db.execute(select(User).order_by(User.name))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ADMIN")),
):
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        name=user_data.name,
        email=user_data.email,
        role=user_data.role,
        password_hash=get_password_hash(user_data.password),
    )
    db.add(user)
    await create_audit_log(db, "CREATE_USER", f"user:{user.email}", user_id=current_user.id)
    await db.flush()
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ADMIN")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    await create_audit_log(db, "UPDATE_USER", f"user:{user_id}", user_id=current_user.id)
    return user


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: UUID,
    body: PasswordResetBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ADMIN")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = get_password_hash(body.password)
    await create_audit_log(db, "RESET_PASSWORD", f"user:{user_id}", user_id=current_user.id)
    return {"status": "ok"}
