from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "__SERVICE_ID__"
    service_port: int = __PORT__


@lru_cache
def get_settings() -> Settings:
    return Settings()
