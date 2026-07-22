import json
from pathlib import Path

from service.app import create_app

target = Path(__file__).parents[1] / "contracts" / "openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(
    json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(target)
