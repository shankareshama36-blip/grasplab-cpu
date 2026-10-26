import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.db import Base
from backend.models import User, Program, Run, init_db, verify_password, hash_password


@pytest.fixture(name="db_session")
def fixture_db_session():
    test_engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_init_db_seeding(db_session):
    init_db(db_session=db_session)

    demo_user = db_session.query(User).filter_by(email="demo@grasplab.dev").first()
    assert demo_user is not None
    assert demo_user.role == "Student"
    assert demo_user.tenant_id == "demo-tenant"
    assert verify_password("demo1234", demo_user.hashed_password)

    sample_prog = db_session.query(Program).filter_by(tenant_id="demo-tenant").first()
    assert sample_prog is not None
    assert sample_prog.name == "Array Sum with Branch"
    assert "LOAD R1, 3" in sample_prog.assembly_source
    assert sample_prog.isa_preset == "RISC-V"


def test_models_tenant_isolation(db_session):
    # Seed Company A
    user_a = User(
        email="alice@company-a.com",
        hashed_password=hash_password("secret123"),
        role="Instructor",
        tenant_id="tenant-a"
    )
    db_session.add(user_a)
    prog_a = Program(
        tenant_id="tenant-a",
        name="Pipeline Demo A",
        assembly_source="LOAD R1, 1\nHALT",
        isa_preset="MIPS"
    )
    db_session.add(prog_a)
    db_session.commit()

    # Seed Company B
    user_b = User(
        email="bob@company-b.com",
        hashed_password=hash_password("secret456"),
        role="Student",
        tenant_id="tenant-b"
    )
    db_session.add(user_b)
    prog_b = Program(
        tenant_id="tenant-b",
        name="Pipeline Demo B",
        assembly_source="LOAD R2, 2\nHALT",
        isa_preset="x86"
    )
    db_session.add(prog_b)
    db_session.commit()

    # Query strictly by tenant
    tenant_a_progs = db_session.query(Program).filter(Program.tenant_id == "tenant-a").all()
    assert len(tenant_a_progs) == 1
    assert tenant_a_progs[0].name == "Pipeline Demo A"

    tenant_b_progs = db_session.query(Program).filter(Program.tenant_id == "tenant-b").all()
    assert len(tenant_b_progs) == 1
    assert tenant_b_progs[0].name == "Pipeline Demo B"

    # Add Run to prog_a
    run_a = Run(
        tenant_id="tenant-a",
        program_id=prog_a.id,
        cycles=15,
        cpi=1.25,
        hazards_json='{"data": 2, "control": 0, "structural": 0}'
    )
    db_session.add(run_a)
    db_session.commit()

    runs_for_b = db_session.query(Run).filter(Run.tenant_id == "tenant-b").all()
    assert len(runs_for_b) == 0

    runs_for_a = db_session.query(Run).filter(Run.tenant_id == "tenant-a").all()
    assert len(runs_for_a) == 1
    assert runs_for_a[0].cycles == 15
