from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Record(ApiModel):
    id: str
    name: str
    completed: bool
    created_at: datetime
    updated_at: datetime


class RecordList(ApiModel):
    items: list[Record]
    total: int = Field(ge=0)


class CreateRecordRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name 不能为空")
        return normalized


class UpdateRecordRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    completed: bool | None = None

    @model_validator(mode="after")
    def require_change(self) -> "UpdateRecordRequest":
        if self.name is None and self.completed is None:
            raise ValueError("name 和 completed 至少提供一个")
        if self.name is not None:
            self.name = self.name.strip()
        return self
