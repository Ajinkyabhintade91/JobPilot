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
    # storage access (CV download) - service key stays server-side only
    supabase_url: str = "http://kong:8000"
    service_role_key: str = ""
    # polite crawling — set USER_AGENT in .env to add a contact address
    user_agent: str = "JobPilot/0.1 (personal job search)"
    request_timeout_s: float = 20.0
    inter_company_delay_s: float = 0.75


@lru_cache
def settings() -> Settings:
    return Settings()
