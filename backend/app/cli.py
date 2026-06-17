import asyncio
import sys

from sqlalchemy import select

from app.core.logging import setup_logging
from app.core.security import get_password_hash
from app.database.session import AsyncSessionLocal, Base, engine
from app.models.models import User

setup_logging()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def create_admin(email: str, password: str, name: str = "SOC Admin") -> None:
    await init_db()
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            existing.password_hash = get_password_hash(password)
            existing.name = name
            existing.role = "SOC_ADMIN"
            existing.is_active = True
            await session.commit()
            print(f"Admin user updated: {email}")
            return

        admin = User(
            name=name,
            email=email,
            role="SOC_ADMIN",
            password_hash=get_password_hash(password),
        )
        session.add(admin)
        await session.commit()
        print(f"Admin user created: {email}")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli <command> [args]")
        print("Commands: init-db | create-admin <email> <password> [name]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "init-db":
        asyncio.run(init_db())
        print("Database initialized")
    elif command == "create-admin":
        if len(sys.argv) < 4:
            print("Usage: python -m app.cli create-admin <email> <password> [name]")
            sys.exit(1)
        email = sys.argv[2]
        password = sys.argv[3]
        name = sys.argv[4] if len(sys.argv) > 4 else "SOC Admin"
        asyncio.run(create_admin(email, password, name))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
