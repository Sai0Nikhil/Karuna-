"""KARUNA backend — runtime configuration loaded from environment."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    DATABASE_URL: str = "sqlite:///./karuna.db"
    JWT_SECRET: str = "dev-only-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def claude_enabled(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY and len(self.ANTHROPIC_API_KEY) > 10)


settings = Settings()
