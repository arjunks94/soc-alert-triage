from prometheus_client import Counter, Gauge, Histogram

ALERT_COUNT = Gauge("soc_alert_count", "Number of alerts by severity and status", ["severity", "status"])
INCIDENT_COUNT = Gauge("soc_incident_count", "Number of incidents by status", ["status"])
API_REQUESTS = Counter("soc_api_requests_total", "Total API requests", ["method", "endpoint", "status"])
SYNC_DURATION = Histogram("soc_sync_duration_seconds", "Duration of sync tasks", ["task_name"])
SYNC_ERRORS = Counter("soc_sync_errors_total", "Total sync errors", ["task_name"])
ONLINE_AGENTS = Gauge("soc_online_agents", "Number of online agents")
OFFLINE_AGENTS = Gauge("soc_offline_agents", "Number of offline agents")
