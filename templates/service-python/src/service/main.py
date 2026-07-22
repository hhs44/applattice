import uvicorn

from .config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run("service.app:app", host="0.0.0.0", port=settings.service_port)


if __name__ == "__main__":
    main()
