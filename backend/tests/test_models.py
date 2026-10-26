import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models import User, Program, Run, init_db, verify_password


def test_init_db_seeds_demo_user_and_program():
    # Set up isolated in-memory SQLite database
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()

    try:
        # Run init_db()
        init_db(db_session=session, db_engine=test_engine)

        # 1. Assert demo user exists
        demo_user = session.query(User).filter_by(email="demo@grasplab.dev").first()
        assert demo_user is not None
        assert demo_user.role.lower() == "student"
        assert demo_user.tenant_id == "demo-tenant"
        assert verify_password("demo1234", demo_user.hashed_password)

        # 2. Assert demo program exists
        demo_program = session.query(Program).filter_by(
            tenant_id="demo-tenant",
            name="Array Sum with Branch"
        ).first()
        assert demo_program is not None
        assert "LOAD R1, 3" in demo_program.assembly_source
        assert "BRNZ R1, LOOP" in demo_program.assembly_source
        assert demo_program.status == "ready"
    finally:
        session.close()
