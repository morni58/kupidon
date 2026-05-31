from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    BOT_TOKEN: str
    ADMIN_IDS: str = ""
    WEBAPP_URL: str = ""

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24 * 30

    S3_ENDPOINT: str = ""
    S3_BUCKET: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "us-east-1"

    ENVIRONMENT: str = "development"

    @property
    def admin_ids_list(self) -> List[int]:
        if not self.ADMIN_IDS:
            return []
        return [int(x.strip()) for x in self.ADMIN_IDS.split(",") if x.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
