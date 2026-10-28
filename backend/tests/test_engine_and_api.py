import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import (
    init_db,
    SAMPLE_ARRAY_SUM_SOURCE,
    SAMPLE_FACTORIAL_SOURCE,
    SAMPLE_HAZARD_SOURCE,
    SAMPLE_X86_SOURCE,
)
from app.engine.assembler import Assembler
from app.engine.cpu import CPU
from app.engine.pipeline import PipelineEngine


def test_all_sample_programs_assemble_and_execute():
    samples = [
        ("RISC-V", SAMPLE_ARRAY_SUM_SOURCE, {100: 6}),
        ("RISC-V", SAMPLE_FACTORIAL_SOURCE, {150: 24}),
        ("MIPS", SAMPLE_HAZARD_SOURCE, {60: 0}),
        ("x86", SAMPLE_X86_SOURCE, {200: 12}),
    ]
    for preset, src, expected_mem in samples:
        assembler = Assembler(preset=preset)
        instructions, _ = assembler.assemble(src)
        assert len(instructions) > 0

        cpu = CPU(instructions)
        history = cpu.run(max_cycles=100)
        assert cpu.status == "HALTED"
        assert len(history) < 100
        for addr, val in expected_mem.items():
            assert cpu.memory.get(addr) == val

        pipeline = PipelineEngine(instructions, forwarding_enabled=True)
        p_hist = pipeline.run_all(max_cycles=100)
        assert pipeline.is_completed
        assert len(p_hist) < 100


def test_extended_isa_instructions():
    code = """
    mov eax, 10
    inc eax
    shl eax, 1
    sub eax, 2
    mov [50], eax
    mov ebx, [50]
    cmp ebx, 20
    je SUCCESS
    mov ecx, 99
    hlt
    SUCCESS:
    mov ecx, 42
    hlt
    """
    assembler = Assembler(preset="x86")
    instructions, _ = assembler.assemble(code)
    cpu = CPU(instructions)
    cpu.run(max_cycles=50)
    assert cpu.status == "HALTED"
    assert cpu.registers["R0"] == 20  # eax
    assert cpu.registers["R1"] == 20  # ebx
    assert cpu.registers["R2"] == 42  # ecx


def test_pipeline_forwarding_comparison_and_api():
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    init_db(db_session=session, db_engine=test_engine)

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        login_res = client.post("/auth/login", json={"email": "demo@grasplab.dev", "password": "demo1234"})
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        progs = client.get("/programs", headers=headers).json()
        assert len(progs) >= 4

        # Run Array Sum with Branch
        array_prog = next(p for p in progs if "Array Sum" in p["name"])
        run_res = client.post(
            f"/programs/{array_prog['id']}/run",
            json={"forwarding_enabled": True, "record_run": False},
            headers=headers,
        )
        assert run_res.status_code == 200
        data = run_res.json()
        assert data["cpi"] > 1.0  # Has branch flushes
        assert data["hazards"]["total_flushes"] == 2
        assert data["forwarding_comparison"]["forwarding_off"]["stalls"] > data["forwarding_comparison"]["forwarding_on"]["stalls"]

        # Test standalone simulate endpoint
        sim_res = client.post(
            "/simulate/run",
            json={"assembly_source": SAMPLE_X86_SOURCE, "isa_preset": "x86"},
            headers=headers,
        )
        assert sim_res.status_code == 200
        assert sim_res.json()["final_cpu_state"]["memory"]["200"] == 12
    finally:
        app.dependency_overrides.clear()
        session.close()
