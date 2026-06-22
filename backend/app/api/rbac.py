from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.database.session import get_db
from app.models.models import User
from app.services.rbac_service import MODULES, PERMISSION_LEVELS, RbacService

router = APIRouter(prefix="/rbac", tags=["RBAC"])
rbac_service = RbacService()


class PermissionsUpdate(BaseModel):
    permissions: dict[str, dict[str, str]] = Field(default_factory=dict)


@router.get("")
async def get_role_permissions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("SOC_ADMIN")),
):
    matrix = await rbac_service.get_permissions(db)
    return rbac_service.describe_matrix(matrix)


@router.put("")
async def save_role_permissions(
    body: PermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("SOC_ADMIN")),
):
    for role, modules in body.permissions.items():
        for module, level in modules.items():
            if module not in MODULES:
                raise HTTPException(status_code=400, detail=f"Unknown module: {module}")
            if level not in PERMISSION_LEVELS:
                raise HTTPException(status_code=400, detail=f"Invalid permission level: {level}")
    matrix = await rbac_service.save_permissions(db, body.permissions, current_user.id)
    return rbac_service.describe_matrix(matrix)


@router.get("/me")
async def get_my_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    matrix = await rbac_service.get_permissions(db)
    role_perms = rbac_service.permissions_for_role(current_user.role, matrix)
    return {
        "role": current_user.role,
        "permissions": role_perms,
        "modules": [{"id": m, "label": m} for m in MODULES],
    }
