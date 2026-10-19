from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config.settings import settings
from app.utils.logger import logger

# Canonical SQLite path (always resolves to backend/diasense.db regardless of working directory)
CANONICAL_SQLITE_PATH = Path(__file__).resolve().parent.parent.parent / "diasense.db"
CANONICAL_SQLITE_URL = f"sqlite:///{CANONICAL_SQLITE_PATH.as_posix()}"

ACTIVE_DB_TYPE = "sqlite"


def _fix_database_url(url: str) -> str:
    """
    Supabase provides 'postgres://' or 'postgresql://' URLs.
    SQLAlchemy requires 'postgresql+psycopg2://' for psycopg2 driver.
    Ensures sslmode=require is appended for secure remote Supabase connections.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    if ("supabase.co" in url or "supabase.com" in url) and "sslmode=" not in url:
        delimiter = "&" if "?" in url else "?"
        url = f"{url}{delimiter}sslmode=require"
    return url


def _create_engine_with_fallback():
    global ACTIVE_DB_TYPE
    url = settings.DATABASE_URL

    if not url or url.startswith("sqlite"):
        ACTIVE_DB_TYPE = "sqlite"
        return create_engine(
            CANONICAL_SQLITE_URL,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
            echo=False,
        )

    # PostgreSQL (Supabase / Render Postgres / any hosted DB)
    fixed_url = _fix_database_url(url)
    try:
        eng = create_engine(
            fixed_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=15,
            echo=False,
        )
        with eng.connect() as conn:
            pass
        ACTIVE_DB_TYPE = "postgresql"
        logger.info("Connected to PostgreSQL database successfully.")
        return eng
    except Exception as e:
        ACTIVE_DB_TYPE = "sqlite"
        logger.warning(
            f"PostgreSQL connection to Supabase failed ({e}). "
            f"Using persistent canonical local database at: {CANONICAL_SQLITE_PATH}"
        )
        return create_engine(
            CANONICAL_SQLITE_URL,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
            echo=False,
        )


engine = _create_engine_with_fallback()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    FastAPI Dependency that provides a database session per request,
    ensuring proper closing upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Creates all database tables defined in SQLAlchemy ORM models.
    Applies non-destructive schema migrations (e.g. adding reset_token columns).
    """
    try:
        from app.models import Base  # Import after models are defined
        Base.metadata.create_all(bind=engine)
        logger.info(f"Database tables initialized successfully ({engine.url.drivername}).")

        # Non-destructive migrations for users table
        try:
            inspector = inspect(engine)
            if "users" in inspector.get_table_names():
                cols = [c["name"] for c in inspector.get_columns("users")]
                with engine.connect() as conn:
                    if "reset_token" not in cols:
                        logger.info("Adding 'reset_token' column to users table.")
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)"))
                    if "reset_token_expiry" not in cols:
                        logger.info("Adding 'reset_token_expiry' column to users table.")
                        conn.execute(text("ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP"))
                    conn.commit()
        except Exception as mig_err:
            logger.warning(f"Schema migration warning: {mig_err}")

    except Exception as e:
        logger.error(f"CRITICAL: Table creation failed: {e}. The application may not function correctly.")
        raise


