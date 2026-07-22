from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Todo(ApiModel):
    id: str
    title: str
    completed: bool
    created_at: datetime
    updated_at: datetime


class TodoList(ApiModel):
    items: list[Todo]
    total: int = Field(ge=0)


class CreateTodoRequest(ApiModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("title 不能为空")
        return normalized


class UpdateTodoRequest(ApiModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    completed: bool | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("title 不能为空")
        return normalized

    @model_validator(mode="after")
    def require_change(self) -> "UpdateTodoRequest":
        if self.title is None and self.completed is None:
            raise ValueError("title 和 completed 至少提供一个")
        return self
