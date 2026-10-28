from datetime import datetime, timezone
import bcrypt
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base, engine, SessionLocal


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Student")
    tenant_id = Column(String(100), index=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "tenant_id": self.tenant_id
        }


class Program(Base):
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    assembly_source = Column(Text, nullable=False)
    isa_preset = Column(String(50), nullable=False, default="RISC-V")
    status = Column(String(50), nullable=False, default="ready")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    runs = relationship("Run", back_populates="program", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "assembly_source": self.assembly_source,
            "isa_preset": self.isa_preset,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id = Column(String(100), index=True, nullable=False)
    program_id = Column(Integer, ForeignKey("programs.id"), nullable=False, index=True)
    cycles = Column(Integer, nullable=False, default=0)
    cpi = Column(Float, nullable=False, default=1.0)
    hazards_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    program = relationship("Program", back_populates="runs")

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "program_id": self.program_id,
            "cycles": self.cycles,
            "cpi": self.cpi,
            "hazards_json": self.hazards_json,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


SAMPLE_ARRAY_SUM_SOURCE = """; Array Sum with Branch
; Calculates sum of numbers 3, 2, 1 using a counter loop
LOAD R1, 3        ; R1 = counter (number of iterations)
LOAD R2, 0        ; R2 = accumulator (sum)
LOAD R3, 1        ; R3 = decrement step
LOOP:
ADD R2, R2, R1    ; sum = sum + counter
SUB R1, R1, R3    ; counter = counter - 1
BRNZ R1, LOOP     ; branch to LOOP if counter != 0
STORE R2, [100]   ; write final sum to memory address 100
HALT              ; terminate execution
"""


SAMPLE_FACTORIAL_SOURCE = """; Factorial Calculator
LOAD R1, 4        ; R1 = N (4)
LOAD R2, 1        ; R2 = result (factorial)
LOAD R3, 1        ; R3 = step
FACT_LOOP:
MUL R2, R2, R1    ; result = result * N
SUB R1, R1, R3    ; N = N - 1
BRNZ R1, FACT_LOOP; loop until N == 0
STORE R2, [150]   ; store 24 at address 150
HALT
"""

SAMPLE_HAZARD_SOURCE = """; Load-Use Data Hazard Demo
LOAD R1, [50]     ; Memory load into R1
ADD R2, R1, R3    ; Dependent instruction immediately uses R1 (Stall required!)
SUB R4, R2, R5    ; Second dependency resolved via Forwarding
STORE R4, [60]
HALT
"""

SAMPLE_X86_SOURCE = """; x86 Arithmetic Loop
mov eax, 10
mov ebx, 2
add eax, ebx
mov [200], eax
hlt
"""


def seed_tenant_programs(db_session, tenant_id: str) -> list:
    """
    Seeds the 4 starter sample programs + baseline run records for a given tenant_id.
    """
    programs_data = [
        ("Array Sum with Branch", SAMPLE_ARRAY_SUM_SOURCE, "RISC-V", 14, 1.15, '{"data": 1, "control": 2, "structural": 0, "total_stalls": 0, "total_flushes": 2}'),
        ("Factorial Loop (4! = 24)", SAMPLE_FACTORIAL_SOURCE, "RISC-V", 22, 1.22, '{"data": 2, "control": 3, "structural": 0, "total_stalls": 0, "total_flushes": 3}'),
        ("Load-Use Hazard Demonstration", SAMPLE_HAZARD_SOURCE, "MIPS", 8, 1.60, '{"data": 2, "control": 0, "structural": 1, "total_stalls": 2, "total_flushes": 0}'),
        ("x86 Arithmetic Accumulator", SAMPLE_X86_SOURCE, "x86", 6, 1.20, '{"data": 1, "control": 0, "structural": 0, "total_stalls": 0, "total_flushes": 0}'),
    ]

    seeded = []
    for name, src, preset, cycles, cpi, hazards in programs_data:
        prog = db_session.query(Program).filter(
            Program.tenant_id == tenant_id,
            Program.name == name
        ).first()

        if not prog:
            prog = Program(
                tenant_id=tenant_id,
                name=name,
                assembly_source=src,
                isa_preset=preset,
                status="ready"
            )
            db_session.add(prog)
            db_session.flush()

            run_rec = Run(
                tenant_id=tenant_id,
                program_id=prog.id,
                cycles=cycles,
                cpi=cpi,
                hazards_json=hazards
            )
            db_session.add(run_rec)
        seeded.append(prog)
    return seeded


def init_db(db_session=None, db_engine=None):
    """
    Initializes database tables and seeds demo accounts (Student + Instructor) + sample programs.
    """
    target_engine = db_engine or engine
    Base.metadata.create_all(bind=target_engine)

    close_session = False
    if db_session is None:
        db_session = SessionLocal()
        close_session = True

    try:
        # 1. Seed Demo Accounts
        accounts = [
            ("demo@grasplab.dev", "demo1234", "Student", "demo-tenant"),
            ("student@grasplab.dev", "student123", "Student", "demo-tenant"),
            ("instructor@grasplab.dev", "instructor123", "Instructor", "demo-tenant"),
        ]

        for email, password, role, tenant_id in accounts:
            user = db_session.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    tenant_id=tenant_id
                )
                db_session.add(user)

        db_session.flush()

        # 2. Seed Sample Programs for demo-tenant
        seed_tenant_programs(db_session, "demo-tenant")

        db_session.commit()
    except Exception:
        db_session.rollback()
        raise
    finally:
        if close_session:
            db_session.close()
