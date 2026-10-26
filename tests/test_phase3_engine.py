import pytest
from engine.assembler import Assembler, AssemblyError
from engine.cpu import CPU
from engine.pipeline import PipelineEngine
from engine.performance import PerformanceCalculator, NumberSystems


# -------------------------------------------------------------
# 1. Pure Engine Unit Tests
# -------------------------------------------------------------
def test_assembler_presets():
    # RISC-V preset
    src_riscv = """
    li x1, 10
    addi x2, x1, 5
    sw x2, 0(x1)
    halt
    """
    asm_rv = Assembler(preset="RISC-V")
    instrs_rv, _ = asm_rv.assemble(src_riscv)
    assert len(instrs_rv) == 4
    assert instrs_rv[0].opcode == "LOAD"
    assert instrs_rv[0].rd == "R1"
    assert instrs_rv[1].opcode == "ADDI"
    assert instrs_rv[1].rd == "R2"

    # MIPS preset
    src_mips = """
    add $t0, $zero, $t1
    sw $t0, 100($t1)
    syscall
    """
    asm_mips = Assembler(preset="MIPS")
    instrs_mips, _ = asm_mips.assemble(src_mips)
    assert len(instrs_mips) == 3
    assert instrs_mips[0].rd == "R1"
    assert instrs_mips[0].rs1 == "R0"
    assert instrs_mips[2].opcode == "HALT"

    # x86 preset
    src_x86 = """
    mov eax, 42
    add ebx, eax
    hlt
    """
    asm_x86 = Assembler(preset="x86")
    instrs_x86, _ = asm_x86.assemble(src_x86)
    assert len(instrs_x86) == 3
    assert instrs_x86[0].rd == "R0"
    assert instrs_x86[1].rd == "R1"
    assert instrs_x86[2].opcode == "HALT"


def test_cpu_execution_logic():
    src = """
    LOAD R1, 5
    LOAD R2, 10
    ADD R3, R1, R2
    STORE R3, [50]
    HALT
    """
    asm = Assembler()
    instructions, _ = asm.assemble(src)
    cpu = CPU(instructions)

    states = cpu.run()
    assert cpu.status == "HALTED"
    assert cpu.registers["R1"] == 5
    assert cpu.registers["R2"] == 10
    assert cpu.registers["R3"] == 15
    assert cpu.memory[50] == 15
    assert cpu.instruction_count == 5


def test_pipeline_forwarding_and_hazard_detection():
    # Code with immediate RAW hazard:
    # ADD R1, R2, R3
    # SUB R4, R1, R5 (reads R1 which was just produced by ADD)
    src = """
    ADD R1, R2, R3
    SUB R4, R1, R5
    HALT
    """
    instructions, _ = Assembler().assemble(src)

    # 1. With Forwarding ON
    pipe_fwd = PipelineEngine(instructions, forwarding_enabled=True)
    pipe_fwd.run_all()
    # With forwarding, ALU->ALU requires 0 stalls
    assert pipe_fwd.total_stalls == 0
    assert pipe_fwd.cumulative_hazards["data"] > 0

    # 2. With Forwarding OFF
    pipe_no_fwd = PipelineEngine(instructions, forwarding_enabled=False)
    pipe_no_fwd.run_all()
    # Without forwarding, must stall
    assert pipe_no_fwd.total_stalls > 0


def test_pipeline_load_use_hazard():
    # Load-Use hazard: requires 1 stall even with forwarding!
    src = """
    LOAD R1, [100]
    ADD R2, R1, R3
    HALT
    """
    instructions, _ = Assembler().assemble(src)
    pipe = PipelineEngine(instructions, forwarding_enabled=True)
    pipe.run_all()
    assert pipe.total_stalls >= 1


def test_amdahl_and_number_systems():
    amdahl = PerformanceCalculator.calculate_amdahl(parallel_fraction=0.8, speedup_factor=4.0)
    # S = 1 / ((1 - 0.8) + (0.8 / 4)) = 1 / (0.2 + 0.2) = 1 / 0.4 = 2.5
    assert amdahl["overall_speedup"] == 2.5
    # Max = 1 / (1 - 0.8) = 5.0
    assert amdahl["theoretical_max"] == 5.0

    twos = NumberSystems.twos_complement_breakdown(val=-5, bits=8)
    assert twos["is_negative"] is True
    # 5 in 8 bits is 00000101; inverted is 11111010; + 1 is 11111011
    assert twos["twos_complement_binary"] == "11111011"
    assert twos["hex"] == "0xFB"

    # Bitwise
    bw = NumberSystems.bitwise_operation("AND", 12, 5, 8)
    # 12 = 00001100, 5 = 00000101 -> AND = 00000100 (4)
    assert bw["decimal_out"] == 4


# -------------------------------------------------------------
# 2. API Integration Tests (Endpoints & Cross-Tenant Security)
# -------------------------------------------------------------
def test_api_program_run_and_step(client):
    # Login demo user
    login_resp = client.post("/auth/login", json={"email": "demo@grasplab.dev", "password": "demo1234"})
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get sample program
    progs_resp = client.get("/programs", headers=headers)
    assert progs_resp.status_code == 200
    progs = progs_resp.json()
    assert len(progs) >= 1
    prog_id = progs[0]["id"]

    # Step endpoint
    step_resp = client.post(f"/programs/{prog_id}/step", json={"step_index": 0}, headers=headers)
    assert step_resp.status_code == 200
    step_data = step_resp.json()
    assert "cpu_state" in step_data
    assert "pipeline_state" in step_data

    # Run endpoint
    run_resp = client.post(f"/programs/{prog_id}/run", json={"max_cycles": 100}, headers=headers)
    assert run_resp.status_code == 200
    run_data = run_resp.json()
    assert run_data["cpi"] > 0
    assert "run_id" in run_data
    assert "final_cpu_state" in run_data
    # In the sample program (sum 3, 2, 1), the result 6 is stored in MEM[100]
    mem = run_data["final_cpu_state"]["memory"]
    assert mem.get("100") == 6 or mem.get(100) == 6


def test_api_cross_tenant_isolation_404(client):
    # Demo user is in demo-tenant
    login_demo = client.post("/auth/login", json={"email": "demo@grasplab.dev", "password": "demo1234"})
    demo_token = login_demo.json()["access_token"]
    demo_headers = {"Authorization": f"Bearer {demo_token}"}
    demo_progs = client.get("/programs", headers=demo_headers).json()
    prog_id = demo_progs[0]["id"]

    # Signup a second user in a different company
    signup_resp = client.post("/auth/signup", json={
        "email": "external@competitor.com",
        "password": "securepassword",
        "company_name": "Rival University",
        "role": "Student"
    })
    rival_token = signup_resp.json()["access_token"]
    rival_headers = {"Authorization": f"Bearer {rival_token}"}

    # Rival cannot see demo-tenant's programs list
    rival_progs = client.get("/programs", headers=rival_headers).json()
    assert len(rival_progs) == 0

    # Rival attempting to GET demo's program gets 404 (NOT 200, NOT leaking data)
    rival_get = client.get(f"/programs/{prog_id}", headers=rival_headers)
    assert rival_get.status_code == 404

    # Rival attempting to RUN demo's program gets 404
    rival_run = client.post(f"/programs/{prog_id}/run", json={}, headers=rival_headers)
    assert rival_run.status_code == 404
