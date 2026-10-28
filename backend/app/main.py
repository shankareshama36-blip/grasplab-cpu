import os
import json
import re
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.db import get_db
from app.models import User, Program, Run, init_db, seed_tenant_programs, hash_password, verify_password
from app.auth import create_access_token, get_current_user
from app.schemas import (
    UserSignupRequest,
    UserLoginRequest,
    AuthResponse,
    UserResponse,
    ProgramCreateRequest,
    ProgramUpdateRequest,
    StepRequest,
    RunRequest,
)
from app.engine.assembler import Assembler, AssemblyError
from app.engine.cpu import CPU, CPUState
from app.engine.pipeline import PipelineEngine, PipelineState
from app.engine.performance import PerformanceCalculator, NumberSystems

# Initialize slowapi rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="GraspLab API",
    description="Interactive Computer Architecture Multi-Tenant SaaS Engine",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins_env = os.getenv("CORS_ORIGINS", "")
if allowed_origins_env:
    origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def slugify_tenant(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s_-]", "", name).strip().lower()
    slug = re.sub(r"[\s_]+", "-", cleaned)
    return slug or "default-tenant"


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "GraspLab API"}


# ---------------------------------------------------------
# Authentication Routes
# ---------------------------------------------------------
@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("15/minute")
def signup(request: Request, payload: UserSignupRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    tenant_id = slugify_tenant(payload.company_name)
    hashed_pwd = hash_password(payload.password)

    new_user = User(
        email=normalized_email,
        hashed_password=hashed_pwd,
        role=payload.role if payload.role in ("Student", "Instructor") else "Student",
        tenant_id=tenant_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "tenant_id": new_user.tenant_id
    })

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            email=new_user.email,
            role=new_user.role,
            tenant_id=new_user.tenant_id
        )
    )


@app.post("/auth/login", response_model=AuthResponse)
@limiter.limit("30/minute")
def login(request: Request, payload: UserLoginRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id
    })

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            tenant_id=user.tenant_id
        )
    )


@app.get("/auth/verify")
def verify_token(current_user: User = Depends(get_current_user)):
    return {
        "valid": True,
        "user": current_user.to_dict()
    }


# ---------------------------------------------------------
# Programs API (Phase 3 Multi-Tenant Isolation)
# ---------------------------------------------------------
@app.get("/programs")
def list_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    programs = db.query(Program).filter(Program.tenant_id == current_user.tenant_id).all()
    return [p.to_dict() for p in programs]


@app.post("/programs/seed-samples", status_code=status.HTTP_201_CREATED)
def seed_sample_programs_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    seeded = seed_tenant_programs(db, current_user.tenant_id)
    db.commit()
    for p in seeded:
        db.refresh(p)
    return [p.to_dict() for p in seeded]


@app.post("/programs", status_code=status.HTTP_201_CREATED)
def create_program(
    payload: ProgramCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate assembly syntax on save
    assembler = Assembler(preset=payload.isa_preset or "RISC-V")
    try:
        assembler.assemble(payload.assembly_source)
    except AssemblyError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

    prog = Program(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        assembly_source=payload.assembly_source,
        isa_preset=payload.isa_preset or "RISC-V",
        status="ready"
    )
    db.add(prog)
    db.commit()
    db.refresh(prog)
    return prog.to_dict()


@app.get("/programs/{program_id}")
def get_program(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Strict cross-tenant protection: return 404 rather than 403 to avoid information disclosure
    prog = db.query(Program).filter(
        Program.id == program_id,
        Program.tenant_id == current_user.tenant_id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return prog.to_dict()


@app.put("/programs/{program_id}")
def update_program(
    program_id: int,
    payload: ProgramUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prog = db.query(Program).filter(
        Program.id == program_id,
        Program.tenant_id == current_user.tenant_id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    if payload.name is not None:
        prog.name = payload.name
    if payload.isa_preset is not None:
        prog.isa_preset = payload.isa_preset
    if payload.assembly_source is not None:
        assembler = Assembler(preset=prog.isa_preset)
        try:
            assembler.assemble(payload.assembly_source)
        except AssemblyError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        prog.assembly_source = payload.assembly_source

    db.commit()
    db.refresh(prog)
    return prog.to_dict()


@app.delete("/programs/{program_id}")
def delete_program(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prog = db.query(Program).filter(
        Program.id == program_id,
        Program.tenant_id == current_user.tenant_id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    db.delete(prog)
    db.commit()
    return {"message": "Program deleted successfully"}


# ---------------------------------------------------------
# Engine Step & Run Execution Helpers & Endpoints (Phase 3)
# ---------------------------------------------------------
def _execute_step_logic(
    source: str,
    preset: str,
    step_index: int,
    forwarding_enabled: bool,
    program_id: Optional[int] = None
) -> Dict[str, Any]:
    assembler = Assembler(preset=preset)
    try:
        instructions, _ = assembler.assemble(source)
    except AssemblyError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not instructions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No instructions to execute")

    # Step single-cycle CPU
    cpu = CPU(instructions)
    target_step = max(1, step_index + 1)
    cpu_state: Optional[CPUState] = None
    actual_step = 0
    for _ in range(target_step):
        cpu_state = cpu.step()
        actual_step += 1
        if cpu.status == "HALTED":
            break

    # Step 5-stage pipeline
    pipeline = PipelineEngine(instructions, forwarding_enabled=forwarding_enabled)
    pipeline_state: Optional[PipelineState] = None
    for _ in range(target_step):
        pipeline_state = pipeline.step()
        if pipeline.is_completed:
            break

    return {
        "program_id": program_id,
        "step_index": actual_step,
        "cpu_state": cpu_state.to_dict() if cpu_state else None,
        "pipeline_state": pipeline_state.to_dict() if pipeline_state else None
    }


def _execute_run_logic(
    source: str,
    preset: str,
    forwarding: bool,
    max_cycles: int
) -> Dict[str, Any]:
    assembler = Assembler(preset=preset)
    try:
        instructions, _ = assembler.assemble(source)
    except AssemblyError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    if not instructions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No instructions in program")

    # 1. Run Single-Cycle CPU
    cpu = CPU(instructions)
    cpu_history = cpu.run(max_cycles=max_cycles)
    final_cpu_state = cpu.get_state()

    # 2. Run 5-Stage Pipeline Engine (Requested mode)
    pipeline = PipelineEngine(instructions, forwarding_enabled=forwarding)
    pipeline_history = pipeline.run_all(max_cycles=max_cycles)

    # Run alternate forwarding mode for instant comparison
    alt_pipeline = PipelineEngine(instructions, forwarding_enabled=not forwarding)
    alt_pipeline.run_all(max_cycles=max_cycles)

    pipe_on = pipeline if forwarding else alt_pipeline
    pipe_off = alt_pipeline if forwarding else pipeline

    # 3. Calculate Accurate Pipelined Performance Metrics
    penalty_cycles = pipeline.total_stalls + pipeline.total_flushes
    effective_cycles = max(1, cpu.instruction_count + penalty_cycles)
    cpi = PerformanceCalculator.calculate_cpi(effective_cycles, cpu.instruction_count)

    perf_details = PerformanceCalculator.calculate_execution_time(
        instruction_count=cpu.instruction_count,
        cpi=cpi,
        clock_mhz=1000.0
    )
    pipeline_comparison = PerformanceCalculator.compare_pipelines(
        stages=5,
        total_instructions=max(1, cpu.instruction_count),
        hazard_stalls=penalty_cycles
    )

    cpi_on = PerformanceCalculator.calculate_cpi(
        max(1, cpu.instruction_count + pipe_on.total_stalls + pipe_on.total_flushes),
        cpu.instruction_count
    )
    cpi_off = PerformanceCalculator.calculate_cpi(
        max(1, cpu.instruction_count + pipe_off.total_stalls + pipe_off.total_flushes),
        cpu.instruction_count
    )

    hazards_summary = pipeline.cumulative_hazards.copy()
    hazards_summary["total_stalls"] = pipeline.total_stalls
    hazards_summary["total_flushes"] = pipeline.total_flushes

    return {
        "cycles": cpu.cycles,
        "effective_cycles": effective_cycles,
        "pipeline_cycles": len(pipeline_history),
        "instruction_count": cpu.instruction_count,
        "cpi": cpi,
        "performance": perf_details,
        "pipeline_comparison": pipeline_comparison,
        "forwarding_comparison": {
            "forwarding_on": {
                "stalls": pipe_on.total_stalls,
                "flushes": pipe_on.total_flushes,
                "cpi": cpi_on,
                "pipeline_cycles": len(pipe_on.history),
            },
            "forwarding_off": {
                "stalls": pipe_off.total_stalls,
                "flushes": pipe_off.total_flushes,
                "cpi": cpi_off,
                "pipeline_cycles": len(pipe_off.history),
            },
            "stalls_saved": max(0, pipe_off.total_stalls - pipe_on.total_stalls),
        },
        "hazards": hazards_summary,
        "final_cpu_state": final_cpu_state.to_dict(),
        "cpu_trace": [s.to_dict() for s in cpu_history],
        "pipeline_trace": [p.to_dict() for p in pipeline_history]
    }


@app.post("/simulate/step")
def simulate_step_standalone(
    payload: StepRequest,
    current_user: User = Depends(get_current_user)
):
    if not payload.assembly_source:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="assembly_source is required")
    return _execute_step_logic(
        source=payload.assembly_source,
        preset=payload.isa_preset or "RISC-V",
        step_index=payload.step_index or 0,
        forwarding_enabled=True if payload.forwarding_enabled is None else payload.forwarding_enabled,
        program_id=None
    )


@app.post("/simulate/run")
def simulate_run_standalone(
    payload: RunRequest,
    current_user: User = Depends(get_current_user)
):
    if not payload.assembly_source:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="assembly_source is required")
    res = _execute_run_logic(
        source=payload.assembly_source,
        preset=payload.isa_preset or "RISC-V",
        forwarding=True if payload.forwarding_enabled is None else payload.forwarding_enabled,
        max_cycles=payload.max_cycles or 250
    )
    res["run_id"] = 0
    res["program_id"] = 0
    return res


@app.post("/programs/{program_id}/step")
def step_program(
    program_id: int,
    payload: StepRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prog = db.query(Program).filter(
        Program.id == program_id,
        Program.tenant_id == current_user.tenant_id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    source = payload.assembly_source if payload.assembly_source is not None else prog.assembly_source
    preset = payload.isa_preset or prog.isa_preset or "RISC-V"
    return _execute_step_logic(
        source=source,
        preset=preset,
        step_index=payload.step_index or 0,
        forwarding_enabled=True if payload.forwarding_enabled is None else payload.forwarding_enabled,
        program_id=prog.id
    )


@app.post("/programs/{program_id}/run")
def run_program(
    program_id: int,
    payload: RunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prog = db.query(Program).filter(
        Program.id == program_id,
        Program.tenant_id == current_user.tenant_id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    source = payload.assembly_source if payload.assembly_source is not None else prog.assembly_source
    preset = payload.isa_preset or prog.isa_preset or "RISC-V"
    forwarding = True if payload.forwarding_enabled is None else payload.forwarding_enabled
    max_cycles = payload.max_cycles or 250

    res = _execute_run_logic(
        source=source,
        preset=preset,
        forwarding=forwarding,
        max_cycles=max_cycles
    )

    run_id = 0
    if payload.record_run is not False:
        new_run = Run(
            tenant_id=current_user.tenant_id,
            program_id=prog.id,
            cycles=res["cycles"],
            cpi=res["cpi"],
            hazards_json=json.dumps(res["hazards"])
        )
        db.add(new_run)
        db.commit()
        db.refresh(new_run)
        run_id = new_run.id

    res["run_id"] = run_id
    res["program_id"] = prog.id
    return res


# ---------------------------------------------------------
# Educational & Performance Tools (Learn / Optimize Tabs)
# ---------------------------------------------------------
@app.get("/performance/amdahl")
def calculate_amdahl(parallel_fraction: float = 0.5, speedup_factor: float = 4.0):
    return PerformanceCalculator.calculate_amdahl(parallel_fraction, speedup_factor)


@app.get("/tools/twos-complement")
def calculate_twos_complement(value: int = -5, bits: int = 8):
    return NumberSystems.twos_complement_breakdown(value, bits)


@app.get("/tools/bitwise")
def calculate_bitwise(op: str = "AND", val1: int = 12, val2: int = 5, bits: int = 8):
    return NumberSystems.bitwise_operation(op, val1, val2, bits)


# ---------------------------------------------------------
# Instructor Dashboard Endpoints
# ---------------------------------------------------------
@app.get("/instructor/programs")
def instructor_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only list data belonging to the instructor's tenant
    programs = db.query(Program).filter(Program.tenant_id == current_user.tenant_id).all()
    results = []
    for p in programs:
        runs = db.query(Run).filter(Run.program_id == p.id).order_by(Run.created_at.desc()).all()
        runs_data = []
        flagged_hazards = False
        for r in runs:
            hz = json.loads(r.hazards_json) if r.hazards_json else {}
            if hz.get("data", 0) > 0 or hz.get("control", 0) > 0 or hz.get("total_stalls", 0) > 0:
                flagged_hazards = True
            runs_data.append({
                "id": r.id,
                "cycles": r.cycles,
                "cpi": r.cpi,
                "hazards": hz,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })

        results.append({
            "id": p.id,
            "name": p.name,
            "assembly_source": p.assembly_source,
            "isa_preset": p.isa_preset,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "has_hazard_flags": flagged_hazards,
            "runs_count": len(runs),
            "latest_run": runs_data[0] if runs_data else None,
            "runs": runs_data
        })

    return results


# ---------------------------------------------------------
# Static Frontend Serving (for Docker / Production / Local)
# ---------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_repo_root = os.path.dirname(_base_dir)
_candidate_static_dirs = [
    os.path.join(_base_dir, "static"),
    os.path.join(os.getcwd(), "static"),
    os.path.join(_repo_root, "frontend", "dist"),
]
static_dir = next((d for d in _candidate_static_dirs if os.path.isdir(d)), "")

if static_dir and os.path.isdir(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(static_dir, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Not Found")
