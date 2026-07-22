import json
from pathlib import Path

from service.app import create_app
from service.config import Settings

target = Path(__file__).parents[1] / "contracts" / "openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
settings = Settings(todo_database_path=Path(":memory:"))
target.write_text(
    json.dumps(create_app(settings).openapi(), ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(target)
