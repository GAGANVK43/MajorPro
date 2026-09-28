from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config.settings import settings
from app.utils.logger import logger

def _create_engine_with_fallback():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False}, pool_pre_ping=True, echo=False)
    
    # Try remote database with connect_timeout
    try:
        eng = create_engine(url, connect_args={"connect_timeout": 3}, pool_pre_ping=True, echo=False)
        with eng.connect() as conn:
            pass
        return eng
    except Exception as e:
        logger.warning(f"Remote database unreachable ({e}). Falling back to local SQLite database.")
        return create_engine("sqlite:///./diasense.db", connect_args={"check_same_thread": False}, pool_pre_ping=True, echo=False)

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
