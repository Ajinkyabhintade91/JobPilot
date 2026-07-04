from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    jobpilot_user_id: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    litellm_base_url: str = "http://litellm:4000"
    litellm_master_key: str = ""
    embedding_dim: int = 1024
    # polite crawling
    user_agent: str = (
        "JobPilot/0.1 (personal job search; contact: ajinkyabhintade91@gmail.com)"
    )
    request_timeout_s: float = 20.0
    inter_company_delay_s: float = 0.75


@lru_cache
def settings() -> Settings:
    return Settings()
