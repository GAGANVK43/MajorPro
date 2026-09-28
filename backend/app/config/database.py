from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config.settings import settings
from app.utils.logger import logger


def _fix_database_url(url: str) -> str:
    """
    Supabase provides 'postgres://' or 'postgresql://' URLs.
    SQLAlchemy requires 'postgresql+psycopg2://' for psycopg2 driver.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _create_engine_with_fallback():
    url = settings.DATABASE_URL

    if url.startswith("sqlite"):
        return create_engine(
            url,
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
            pool_timeout=30,
            echo=False,
        )
        with eng.connect() as conn:
            pass
        logger.info(f"Connected to PostgreSQL database successfully.")
        return eng
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed ({e}). Falling back to local SQLite.")
        return create_engine(
            "sqlite:///./diasense.db",
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
    Automatically creates all database tables defined in SQLAlchemy ORM models.
    Falls back to local SQLite if remote database fails.
    """
    global engine, SessionLocal
    try:
        from app.models import Base  # Import after models are defined
        Base.metadata.create_all(bind=engine)
        logger.info(f"Database tables initialized successfully ({engine.url.drivername}).")
    except Exception as e:
        logger.warning(f"Initial table creation failed: {e}. Switching to local SQLite.")
        engine = create_engine("sqlite:///./diasense.db", connect_args={"check_same_thread": False}, pool_pre_ping=True, echo=False)
        SessionLocal.configure(bind=engine)
        from app.models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("Local SQLite database tables initialized successfully.")
