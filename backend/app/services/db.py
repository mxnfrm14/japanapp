"""PostgreSQL connection helper for JapanApp."""

from contextlib import contextmanager

from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

from app.config import settings

_connection_pool: SimpleConnectionPool | None = None


def get_connection_pool() -> SimpleConnectionPool:
    """Create the pool on first use and reuse it for later requests."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=settings.database_url,
        )
    return _connection_pool


def get_db_connection():
    """Get a pooled PostgreSQL connection.

    Prefer using `get_db_cursor()` for request handlers and repository helpers.
    """
    return get_connection_pool().getconn()


def release_db_connection(connection) -> None:
    """Return a pooled connection to the pool."""
    get_connection_pool().putconn(connection)


@contextmanager
def get_db_cursor(dict_cursor: bool = True):
    """Yield a cursor from the shared pool and clean up automatically."""
    connection = get_db_connection()
    cursor_factory = RealDictCursor if dict_cursor else None
    try:
        with connection.cursor(cursor_factory=cursor_factory) as cursor:
            yield cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        release_db_connection(connection)
