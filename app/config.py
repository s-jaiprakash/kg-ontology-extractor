from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    data_dir: Path = Path("data")
    default_project_id: str = "default"
    ner_model: str = "en_core_web_sm"


settings = Settings()
