from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "todo-list-service"
    service_port: int = 4200
    todo_database_path: Path = Path(".data/todos.db")


@lru_cache
def get_settings() -> Settings:
    return Settings()
