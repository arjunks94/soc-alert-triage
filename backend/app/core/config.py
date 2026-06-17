from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SOC Dashboard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    DATABASE_URL: str = "postgresql+asyncpg://soc:socpassword@postgres:5432/soc_dashboard"
    DATABASE_URL_SYNC: str = "postgresql://soc:socpassword@postgres:5432/soc_dashboard"
    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = Field(default="change-me-in-production-use-strong-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    S1_BASE_URL: str = ""
    S1_API_TOKEN: str = ""

    VIRUSTOTAL_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""
    GREYNOISE_API_KEY: str = ""

    CORS_ORIGINS: List[str] = ["http://localhost", "http://localhost:3000", "http://localhost:5173"]
    RATE_LIMIT_PER_MINUTE: int = 120

    SYNC_ALERTS_INTERVAL_SECONDS: int = 60
    SYNC_AGENTS_INTERVAL_SECONDS: int = 300
    SYNC_INCIDENTS_INTERVAL_SECONDS: int = 120

    ENRICHMENT_CACHE_TTL_SECONDS: int = 3600

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
