from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings().database_url,
            min_size=1,
            max_size=5,
            open=True,
        )
    return _pool


def healthy() -> bool:
    try:
        with pool().connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False
