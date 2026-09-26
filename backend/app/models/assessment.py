"""
SQLAlchemy Assessment Model v2
Migrated from Pima-style features to India Diabetes Dataset features.
Old columns are preserved as nullable for rollback compatibility.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.config.database import Base


class Assessment(Base):
    """
    SQLAlchemy Assessment Model — India Diabetes Dataset schema.
    Table: assessments
    """
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # ── NEW v2 Fields (India Diabetes Dataset) ────────────────────────────────
    patient_group = Column(String(50), nullable=True)          # Urban/Semi-Urban/Rural
    age = Column(Float, nullable=False, default=30.0)
    gender = Column(String(20), nullable=True)
    bmi = Column(Float, nullable=False, default=25.0)
    blood_pressure = Column(Float, nullable=True)
    physical_activity_hours = Column(Float, nullable=True)
    daily_sugar_intake = Column(Float, nullable=True)
    fast_food_frequency = Column(Float, nullable=True)
    sleep_hours = Column(Float, nullable=True)
    hba1c = Column(Float, nullable=True)
    fasting_glucose = Column(Float, nullable=True)
    family_history = Column(Float, nullable=True)              # 0.0 or 1.0
    monthly_income = Column(Float, nullable=True)
    month = Column(Float, nullable=True)

    # ── LEGACY v1 Fields (kept nullable for rollback compatibility) ───────────
    # These are no longer used in inference. Do not remove without a migration plan.
    pregnancies = Column(Integer, nullable=True, default=None)
    glucose = Column(Float, nullable=True, default=None)
    blood_pressure_legacy = Column(Float, nullable=True, default=None)  # renamed to avoid conflict
    skin_thickness = Column(Float, nullable=True, default=None)
    insulin = Column(Float, nullable=True, default=None)
    diabetes_pedigree_function = Column(Float, nullable=True, default=None)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="assessments")
    prediction = relationship(
        "Prediction", back_populates="assessment",
        uselist=False, cascade="all, delete-orphan"
    )
