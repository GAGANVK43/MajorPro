"""
Automated unit test for Dashboard Service with unassessed users.
Verifies that 0-assessment accounts do NOT return fabricated default scores.
"""
import pytest
from app.config.database import SessionLocal
from app.models.user import User
from app.services.dashboard_service import DashboardService


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_dashboard_empty_state_zero_assessments(db_session):
    """Verify that a brand new user with 0 assessments gets null scores, not fabricated 90 or 82."""
    # Create temporary user without assessments
    test_email = "test_empty_state_user@diasense.ai"
    existing = db_session.query(User).filter(User.email == test_email).first()
    if existing:
        user = existing
    else:
        user = User(
            full_name="New Onboarding Patient",
            email=test_email,
            password="mock_hashed_password_123",
            age=30,
            gender="Female",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    service = DashboardService(db_session)
    data = service.get_dashboard_data(user)

    assert data["latest_prediction"] is None
    assert data["diet_plan"] is None
    assert data["risk_level"] is None
    assert data["health_summary"]["health_score"] is None
    assert data["health_summary"]["risk_level"] is None
    assert data["health_summary"]["total_assessments"] == 0
    assert data["health_summary"]["latest_bmi"] is None
    assert data["health_summary"]["last_assessed_at"] is None
