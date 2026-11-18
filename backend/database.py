import os
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_PG_URL = "postgresql+psycopg2://parkpulse:parkpulse_dev@localhost:5432/parkpulse"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SQLITE_FALLBACK_URL = f"sqlite:///{DATA_DIR / 'parkpulse.db'}"


def resolve_database_url() -> tuple[str, str]:
    configured_url = os.environ.get("DATABASE_URL") or DEFAULT_PG_URL
    if configured_url.startswith("postgresql"):
        try:
            test_engine = create_engine(configured_url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            test_engine.dispose()
            return configured_url, "postgresql"
        except Exception:
            return SQLITE_FALLBACK_URL, "sqlite"
    return configured_url, "sqlite" if configured_url.startswith("sqlite") else "postgresql"


DATABASE_URL, DB_ENGINE_NAME = resolve_database_url()

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=DELETE")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
