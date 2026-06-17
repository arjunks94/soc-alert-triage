# SOC Alert Triage

Enterprise Security Operations Center dashboard for alert triage, threat monitoring, and wallboard display. Integrates with SentinelOne Cloud APIs to sync alerts, threats, agents, and endpoints into a centralized analyst portal.

## Tech Stack

### Backend

| Component | Technology |
|-----------|------------|
| Runtime | Python 3.12 |
| API Framework | FastAPI |
| ORM | SQLAlchemy 2.0 |
| Migrations | Alembic |
| Database | PostgreSQL 16 |
| Cache / Broker | Redis 7 |
| Task Queue | Celery + Celery Beat |
| Validation | Pydantic v2 |
| Authentication | JWT (python-jose) + bcrypt |
| HTTP Client | httpx (SentinelOne API) |
| Scheduling | APScheduler |
| Metrics | Prometheus client |
| Logging | structlog (JSON) |

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite 6 |
| UI Library | Material UI 6 |
| Charts | Recharts |
| Data Fetching | TanStack Query |
| State Management | Zustand |
| Routing | React Router 7 |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Containers | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Monitoring | Prometheus + Grafana |
| WebSockets | FastAPI native WS |

## Features

- SentinelOne Cloud API v2.1 integration (alerts, threats, agents, incidents)
- Background sync via Celery (configurable intervals)
- Real-time dashboard with KPIs, MITRE ATT&CK heatmap, and timeline charts
- Alert triage workflow with analyst assignment and bulk actions
- Incident management with timeline, evidence, and case notes
- IOC enrichment (VirusTotal, AbuseIPDB, GreyNoise) with response caching
- Full-screen SOC wallboard mode (15-second auto-refresh)
- WebSocket push updates for alerts, incidents, and dashboard
- Role-based access control (SOC_ADMIN, SOC_MANAGER, SOC_ANALYST, VIEWER)
- Audit logging for all analyst actions
- Prometheus metrics and Grafana dashboards

## Architecture

```
                    ┌─────────────┐
                    │   Nginx     │ :80
                    │  /api /ws   │
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │  Frontend   │           │   Backend   │
       │ React/Vite  │           │   FastAPI   │
       └─────────────┘           └──────┬──────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             ┌───────────┐       ┌───────────┐       ┌───────────┐
             │ PostgreSQL│       │   Redis   │       │  Celery   │
             └───────────┘       └───────────┘       └─────┬─────┘
                                                            │
                                                    SentinelOne API
```

## Prerequisites

- Docker Engine 24 or later
- Docker Compose v2
- SentinelOne Management Console API token with read permissions
- 4 GB RAM minimum (8 GB recommended for production)
- Ports 80, 3001, and 9090 available (configurable)

## Deployment

### 1. Clone the repository

```bash
git clone https://github.com/arjunks94/soc-alert-triage.git
cd soc-alert-triage
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `S1_BASE_URL` | SentinelOne console URL for your region | Yes |
| `S1_API_TOKEN` | SentinelOne API token | Yes |
| `SECRET_KEY` | JWT signing key (generate with `openssl rand -hex 32`) | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes |
| `ADMIN_EMAIL` | Initial SOC admin email | Yes |
| `ADMIN_PASSWORD` | Initial SOC admin password (min 8 characters) | Yes |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key for IOC enrichment | No |
| `ABUSEIPDB_API_KEY` | AbuseIPDB API key | No |
| `GREYNOISE_API_KEY` | GreyNoise API key | No |

**Never commit the `.env` file to version control.**

### 3. Start all services

```bash
docker compose up -d --build
```

This starts:

| Service | Purpose |
|---------|---------|
| `postgres` | Primary database |
| `redis` | Celery broker and cache |
| `backend` | FastAPI application |
| `celery` | Background sync workers |
| `celery-beat` | Scheduled sync tasks |
| `frontend` | React SPA (served via Nginx) |
| `nginx` | Reverse proxy |
| `prometheus` | Metrics collection |
| `grafana` | Monitoring dashboards |

### 4. Verify deployment

```bash
docker compose ps
curl http://localhost/health
```

All containers should report `healthy` or `running`.

### 5. Access the application

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| SOC Dashboard | http://localhost | Set in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| API Documentation | http://localhost/api/docs | Requires login token |
| SOC Wallboard | http://localhost/wallboard | Requires login |
| Grafana | http://localhost:3001 | `admin` / set in `GRAFANA_ADMIN_PASSWORD` |
| Prometheus | http://localhost:9090 | No auth (restrict in production) |

## SentinelOne API Setup

1. Log in to your SentinelOne Management Console.
2. Navigate to **Settings → Users** and create a service user or API token.
3. Grant read permissions for:
   - Threats
   - Agents
   - Cloud Detection Alerts
   - Sites
   - Incidents (if available on your tenant)
4. Copy your console URL (region-specific, e.g. `https://usea1.sentinelone.net`).
5. Set `S1_BASE_URL` and `S1_API_TOKEN` in `.env`.
6. Restart the stack: `docker compose up -d`.

### Sync Schedule

| Data | Interval | Celery Task |
|------|----------|-------------|
| Alerts | 60 seconds | `sync_alerts` |
| Agents | 5 minutes | `sync_agents` |
| Incidents | 2 minutes | `sync_incidents` |
| Threats | 5 minutes | `sync_threats` |

Trigger a manual sync:

```bash
docker compose exec celery celery -A app.tasks.celery_tasks call app.tasks.celery_tasks.sync_agents
docker compose exec celery celery -A app.tasks.celery_tasks call app.tasks.celery_tasks.sync_threats
```

## User Management

The admin account is created automatically on first backend startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. If the email already exists, the password is updated on restart.

Create additional users:

```bash
docker compose exec backend python -m app.cli create-admin analyst@company.com "SecurePassword123!" "Analyst Name"
```

Or register users via the **Analysts** page (SOC_ADMIN role required).

### Roles

| Role | Permissions |
|------|-------------|
| `SOC_ADMIN` | Full access, user management |
| `SOC_MANAGER` | Dashboard, triage, incidents, analysts |
| `SOC_ANALYST` | Alert triage, incidents, enrichment |
| `VIEWER` | Read-only dashboard access |

## SOC Wallboard Setup

1. Open `http://<server-ip>/wallboard` on the SOC display browser.
2. Log in with analyst credentials.
3. Press **F11** for full-screen mode.
4. Data refreshes automatically every 15 seconds.

Recommended display settings:

- 65-inch or larger monitor at 1920×1080 or 4K
- Dark room environment
- Disable screen saver and display sleep
- Use a kiosk browser profile for unattended operation

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `GET` | `/api/dashboard/summary` | KPI counts |
| `GET` | `/api/dashboard/threats` | Live threat feed |
| `GET` | `/api/dashboard/heatmap` | MITRE ATT&CK heatmap |
| `GET` | `/api/dashboard/timeline` | Alerts per hour |
| `GET` | `/api/alerts` | Paginated alerts with filters |
| `PATCH` | `/api/alerts/{id}` | Update alert status or assignment |
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Create incident |
| `GET` | `/api/endpoints` | List managed endpoints |
| `POST` | `/api/enrichment` | Enrich IP, hash, or domain |
| `WS` | `/ws/alerts` | Real-time alert updates |
| `WS` | `/ws/dashboard` | Real-time dashboard updates |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

Interactive documentation: http://localhost/api/docs

## Backup and Restore

### Database backup

```bash
docker compose exec postgres pg_dump -U soc soc_dashboard > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
cat backup_20260101.sql | docker compose exec -T postgres psql -U soc soc_dashboard
```

### Volume backup

```bash
docker run --rm \
  -v soc-alert-triage_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_volume.tar.gz /data
```

## Upgrade

```bash
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec backend alembic upgrade head
```

## Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env   # configure for local use
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
cd backend && pytest
cd frontend && npm test
```

## Security Considerations

- Generate a unique `SECRET_KEY` for every deployment.
- Change all default passwords before production use.
- Restrict Prometheus (`/metrics`) to internal networks (configured in Nginx).
- Terminate TLS at a load balancer or Nginx for internet-facing deployments.
- Rotate SentinelOne API tokens on a regular schedule.
- Review the `audit_logs` table for analyst activity.
- Keep Docker images updated with `docker compose pull && docker compose up -d --build`.

## Project Structure

```
soc-alert-triage/
├── backend/
│   ├── app/
│   │   ├── api/           # REST routes and WebSocket handlers
│   │   ├── core/          # Config, security, logging, metrics
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # SentinelOne client, sync, enrichment
│   │   └── tasks/         # Celery tasks
│   ├── alembic/           # Database migrations
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Alerts, Incidents, Wallboard
│       ├── components/    # Charts, KPI cards, chips
│       └── services/      # API client
├── nginx/                 # Reverse proxy configuration
├── docker/                # Prometheus and Grafana configs
├── docker-compose.yml
└── .env.example
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

Arjun KS — [github.com/arjunks94](https://github.com/arjunks94)
