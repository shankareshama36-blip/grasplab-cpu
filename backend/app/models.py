from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="student")
    tenant_id = Column(String(100), index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "tenant_id": self.tenant_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
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
