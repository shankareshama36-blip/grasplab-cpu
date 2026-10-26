from passlib.context import CryptContext
from app.db import Base, engine, SessionLocal
from app.models import User, Program

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


SAMPLE_ARRAY_SUM_ISA = """LOAD R1, #0
LOAD R2, #1
loop: ADD R1, R2
BRNZ R2, loop
HALT
"""


def init_db(db_session=None, db_engine=None):
    """
    Creates all tables and seeds the demo student user and sample program.
    """
    target_engine = db_engine or engine
    Base.metadata.create_all(bind=target_engine)

    close_session = False
    if db_session is None:
        db_session = SessionLocal()
        close_session = True

    try:
        # 1. Seed Demo User
        demo_user = db_session.query(User).filter(User.email == "demo@grasplab.dev").first()
        if not demo_user:
            demo_user = User(
                email="demo@grasplab.dev",
                hashed_password=hash_password("demo1234"),
                role="student",
                tenant_id="demo-tenant"
            )
            db_session.add(demo_user)
            db_session.flush()

        # 2. Seed Sample Program: Array Sum with Branch using simplified ISA
        sample_program = db_session.query(Program).filter(
            Program.tenant_id == "demo-tenant",
            Program.name == "Array Sum with Branch"
        ).first()

        if not sample_program:
            sample_program = Program(
                tenant_id="demo-tenant",
                name="Array Sum with Branch",
                assembly_source=SAMPLE_ARRAY_SUM_ISA,
                isa_preset="RISC-V-like",
                status="ready"
            )
            db_session.add(sample_program)

        db_session.commit()
    except Exception:
        db_session.rollback()
        raise
    finally:
        if close_session:
            db_session.close()
