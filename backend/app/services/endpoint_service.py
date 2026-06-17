from typing import Any, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Endpoint
from app.utils.sanitize import sanitize_search


class EndpointService:
    def _apply_filters(
        self,
        query,
        hostname: Optional[str] = None,
        site: Optional[str] = None,
        group: Optional[str] = None,
        os_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        online_only: Optional[bool] = None,
    ):
        if hostname:
            hostname = sanitize_search(hostname, 255)
            query = query.where(Endpoint.hostname.ilike(f"%{hostname}%"))
        if site:
            site = sanitize_search(site, 255)
            query = query.where(Endpoint.site_name.ilike(f"%{site}%"))
        if group:
            group = sanitize_search(group, 255)
            query = query.where(Endpoint.group_name.ilike(f"%{group}%"))
        if os_name:
            os_name = sanitize_search(os_name, 100)
            query = query.where(
                or_(
                    Endpoint.os_name.ilike(f"%{os_name}%"),
                    Endpoint.os_version.ilike(f"%{os_name}%"),
                )
            )
        if ip_address:
            ip_address = sanitize_search(ip_address, 45)
            query = query.where(Endpoint.ip_address.ilike(f"%{ip_address}%"))
        if online_only is not None:
            query = query.where(Endpoint.is_online == online_only)
        return query

    async def list_endpoints(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 50,
        hostname: Optional[str] = None,
        site: Optional[str] = None,
        group: Optional[str] = None,
        os_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        online_only: Optional[bool] = None,
    ) -> tuple[list[Endpoint], int]:
        query = select(Endpoint)
        count_query = select(func.count(Endpoint.id))

        query = self._apply_filters(
            query, hostname, site, group, os_name, ip_address, online_only
        )
        count_query = self._apply_filters(
            count_query, hostname, site, group, os_name, ip_address, online_only
        )

        total = await db.scalar(count_query) or 0
        result = await db.execute(
            query.order_by(Endpoint.hostname)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_filter_options(self, db: AsyncSession) -> dict[str, Any]:
        sites = await db.execute(
            select(Endpoint.site_name, func.count(Endpoint.id))
            .where(Endpoint.site_name.isnot(None), Endpoint.site_name != "")
            .group_by(Endpoint.site_name)
            .order_by(func.count(Endpoint.id).desc())
            .limit(50)
        )
        groups = await db.execute(
            select(Endpoint.group_name, func.count(Endpoint.id))
            .where(Endpoint.group_name.isnot(None), Endpoint.group_name != "")
            .group_by(Endpoint.group_name)
            .order_by(func.count(Endpoint.id).desc())
            .limit(50)
        )
        os_list = await db.execute(
            select(Endpoint.os_name, func.count(Endpoint.id))
            .where(Endpoint.os_name.isnot(None), Endpoint.os_name != "")
            .group_by(Endpoint.os_name)
            .order_by(func.count(Endpoint.id).desc())
            .limit(30)
        )
        online = await db.scalar(
            select(func.count(Endpoint.id)).where(Endpoint.is_online.is_(True))
        )
        offline = await db.scalar(
            select(func.count(Endpoint.id)).where(Endpoint.is_online.is_(False))
        )
        total = await db.scalar(select(func.count(Endpoint.id)))

        return {
            "sites": [{"name": r[0], "count": r[1]} for r in sites.all()],
            "groups": [{"name": r[0], "count": r[1]} for r in groups.all()],
            "os_names": [{"name": r[0], "count": r[1]} for r in os_list.all()],
            "total": total or 0,
            "online": online or 0,
            "offline": offline or 0,
        }

    async def get_stats(
        self,
        db: AsyncSession,
        hostname: Optional[str] = None,
        site: Optional[str] = None,
        group: Optional[str] = None,
        os_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        online_only: Optional[bool] = None,
    ) -> dict[str, int]:
        base = select(func.count(Endpoint.id))
        base = self._apply_filters(
            base, hostname, site, group, os_name, ip_address, online_only
        )
        total = await db.scalar(base) or 0

        online_q = self._apply_filters(
            select(func.count(Endpoint.id)),
            hostname, site, group, os_name, ip_address, True,
        )
        offline_q = self._apply_filters(
            select(func.count(Endpoint.id)),
            hostname, site, group, os_name, ip_address, False,
        )
        return {
            "total": total,
            "online": await db.scalar(online_q) or 0,
            "offline": await db.scalar(offline_q) or 0,
        }
