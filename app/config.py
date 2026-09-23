from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    llm_provider: Literal["openai", "azure_openai"] = "openai"

    # Standard OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Azure OpenAI (used when llm_provider == "azure_openai")
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""  # e.g. https://<resource>.openai.azure.com
    azure_openai_api_version: str = "2024-08-01-preview"
    azure_openai_deployment: str = ""  # deployment name, used as the "model" for calls

    data_dir: Path = Path("data")
    default_project_id: str = "default"
    ner_model: str = "en_core_web_sm"

    @property
    def default_llm_model(self) -> str:
        """The model/deployment name used when a request doesn't override one."""
        if self.llm_provider == "azure_openai":
            return self.azure_openai_deployment
        return self.openai_model


settings = Settings()
