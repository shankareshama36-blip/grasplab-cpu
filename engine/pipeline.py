from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any, Set
from engine.isa import Instruction


@dataclass
class Hazard:
    hazard_type: str  # "data" | "control" | "structural"
    description: str
    affected_registers: List[str]
    source_stage: str
    target_stage: str
    resolved_by: str  # "forwarding" | "stall" | "flush"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StageEntry:
    stage: str
    instruction: Optional[Dict[str, Any]]
    is_bubble: bool = False
    bubble_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PipelineState:
    cycle: int
    stages: Dict[str, Optional[Dict[str, Any]]]  # "IF", "ID", "EX", "MEM", "WB"
    active_hazards: List[Dict[str, Any]]
    forwarding_events: List[Dict[str, Any]]
    cumulative_hazards: Dict[str, int]
    total_stalls: int
    total_flushes: int
    forwarding_enabled: bool
    is_completed: bool
    diagram_row: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class PipelineEngine:
    STAGES = ["IF", "ID", "EX", "MEM", "WB"]

    def __init__(
        self,
        instructions: List[Instruction],
        forwarding_enabled: bool = True
    ):
        self.instructions = instructions
        self.forwarding_enabled = forwarding_enabled

        self.cycle = 0
        self.pc = 0

        # Stage registers holding Instruction or None
        self.stage_instructions: Dict[str, Optional[Instruction]] = {s: None for s in self.STAGES}
        self.is_bubble: Dict[str, bool] = {s: False for s in self.STAGES}

        # Metrics
        self.cumulative_hazards: Dict[str, int] = {
            "data": 0,
            "control": 0,
            "structural": 0
        }
        self.total_stalls = 0
        self.total_flushes = 0
        self.is_completed = False

        # History of stages for grid diagram
        self.history: List[PipelineState] = []

    def reset(self):
        self.cycle = 0
        self.pc = 0
        self.stage_instructions = {s: None for s in self.STAGES}
        self.is_bubble = {s: False for s in self.STAGES}
        self.cumulative_hazards = {"data": 0, "control": 0, "structural": 0}
        self.total_stalls = 0
        self.total_flushes = 0
        self.is_completed = False
        self.history.clear()

    def step(self) -> PipelineState:
        if self.is_completed:
            return self.history[-1] if self.history else self._build_state([], [])

        self.cycle += 1
        active_hazards: List[Hazard] = []
        forwarding_events: List[Dict[str, Any]] = []

        instr_if = self.stage_instructions["IF"]
        instr_id = self.stage_instructions["ID"]
        instr_ex = self.stage_instructions["EX"]
        instr_mem = self.stage_instructions["MEM"]
        instr_wb = self.stage_instructions["WB"]

        stall_required = False
        flush_if = False
        flush_id = False

        # -------------------------------------------------------------
        # 1. Structural Hazard Detection:
        # Occurs if MEM accesses memory (LOAD/STORE) while IF fetches.
        # -------------------------------------------------------------
        if instr_mem and not self.is_bubble["MEM"] and instr_mem.opcode in {"LOAD", "STORE"}:
            if self.pc < len(self.instructions):
                # Structural conflict over unified memory bus
                self.cumulative_hazards["structural"] += 1
                active_hazards.append(Hazard(
                    hazard_type="structural",
                    description=f"Unified memory port contention between MEM ({instr_mem.opcode}) and IF fetch",
                    affected_registers=[],
                    source_stage="MEM",
                    target_stage="IF",
                    resolved_by="dual_port_simulated"
                ))

        # -------------------------------------------------------------
        # 2. Data Hazard (RAW) Detection:
        # Check if instruction in ID reads a register written by EX or MEM
        # -------------------------------------------------------------
        if instr_id and not self.is_bubble["ID"]:
            read_regs = instr_id.reads_registers

            # Check producer in EX
            if instr_ex and not self.is_bubble["EX"] and instr_ex.writes_register:
                ex_dest = instr_ex.rd
                if ex_dest and ex_dest in read_regs:
                    self.cumulative_hazards["data"] += 1
                    if self.forwarding_enabled:
                        if instr_ex.opcode == "LOAD":
                            # Load-Use Hazard: Memory value not ready until after MEM stage!
                            # Requires 1 stall cycle even with forwarding!
                            stall_required = True
                            self.total_stalls += 1
                            active_hazards.append(Hazard(
                                hazard_type="data",
                                description=f"Load-Use hazard on register {ex_dest} produced by LOAD in EX",
                                affected_registers=[ex_dest],
                                source_stage="EX",
                                target_stage="ID",
                                resolved_by="stall"
                            ))
                        else:
                            # Forward directly from EX to EX on next cycle
                            forwarding_events.append({
                                "from_stage": "EX",
                                "to_stage": "ID",
                                "register": ex_dest,
                                "description": f"Forward {ex_dest} from EX ALU output to ID/EX"
                            })
                            active_hazards.append(Hazard(
                                hazard_type="data",
                                description=f"RAW hazard on {ex_dest} resolved via EX->EX Forwarding",
                                affected_registers=[ex_dest],
                                source_stage="EX",
                                target_stage="ID",
                                resolved_by="forwarding"
                            ))
                    else:
                        # Without forwarding: must stall until producer completes WB
                        stall_required = True
                        self.total_stalls += 1
                        active_hazards.append(Hazard(
                            hazard_type="data",
                            description=f"RAW hazard on {ex_dest} (Forwarding OFF -> Pipeline Stall)",
                            affected_registers=[ex_dest],
                            source_stage="EX",
                            target_stage="ID",
                            resolved_by="stall"
                        ))

            # Check producer in MEM
            if not stall_required and instr_mem and not self.is_bubble["MEM"] and instr_mem.writes_register:
                mem_dest = instr_mem.rd
                if mem_dest and mem_dest in read_regs:
                    self.cumulative_hazards["data"] += 1
                    if self.forwarding_enabled:
                        forwarding_events.append({
                            "from_stage": "MEM",
                            "to_stage": "ID",
                            "register": mem_dest,
                            "description": f"Forward {mem_dest} from MEM buffer to ID/EX"
                        })
                        active_hazards.append(Hazard(
                            hazard_type="data",
                            description=f"RAW hazard on {mem_dest} resolved via MEM->EX Forwarding",
                            affected_registers=[mem_dest],
                            source_stage="MEM",
                            target_stage="ID",
                            resolved_by="forwarding"
                        ))
                    else:
                        # Without forwarding: must stall 1 cycle for WB writeback
                        stall_required = True
                        self.total_stalls += 1
                        active_hazards.append(Hazard(
                            hazard_type="data",
                            description=f"RAW hazard on {mem_dest} in MEM (Forwarding OFF -> Pipeline Stall)",
                            affected_registers=[mem_dest],
                            source_stage="MEM",
                            target_stage="ID",
                            resolved_by="stall"
                        ))

        # -------------------------------------------------------------
        # 3. Control Hazard Detection:
        # Branch or Jump resolved in ID or EX stage
        # -------------------------------------------------------------
        branch_taken = False
        target_pc: Optional[int] = None

        if instr_id and not self.is_bubble["ID"] and instr_id.is_branch_or_jump:
            # Simple jump or branch: predict not taken; if taken -> flush IF
            if instr_id.opcode in {"JMP", "J"} and instr_id.target_pc is not None:
                branch_taken = True
                target_pc = instr_id.target_pc
            elif instr_id.opcode in {"BRZ", "BRNZ", "BEQ", "BNE", "BLT", "BGT"}:
                # In pipelined architecture, branch condition is resolved in EX or ID
                # If target is taken, penalty of 1 cycle occurs
                branch_taken = True
                target_pc = instr_id.target_pc

        if branch_taken and target_pc is not None and not stall_required:
            self.cumulative_hazards["control"] += 1
            flush_if = True
            self.total_flushes += 1
            active_hazards.append(Hazard(
                hazard_type="control",
                description=f"Control hazard: Branch taken to PC={target_pc}, flushing IF stage",
                affected_registers=[],
                source_stage="ID",
                target_stage="IF",
                resolved_by="flush"
            ))

        # -------------------------------------------------------------
        # 4. Advance Pipeline Stages:
        # -------------------------------------------------------------
        # MEM advances to WB
        next_wb = instr_mem
        next_wb_bubble = self.is_bubble["MEM"]

        # EX advances to MEM
        next_mem = instr_ex
        next_mem_bubble = self.is_bubble["EX"]

        if stall_required:
            # Stall: ID and IF do NOT advance. Bubble injected into EX!
            next_ex = None
            next_ex_bubble = True

            next_id = instr_id
            next_id_bubble = self.is_bubble["ID"]

            next_if = instr_if
            next_if_bubble = self.is_bubble["IF"]
        else:
            # ID advances to EX
            next_ex = instr_id
            next_ex_bubble = self.is_bubble["ID"]

            if flush_if:
                # Flush IF instruction
                next_id = None
                next_id_bubble = True
                self.pc = target_pc if target_pc is not None else self.pc
            else:
                next_id = instr_if
                next_id_bubble = self.is_bubble["IF"]

            # Fetch new instruction into IF
            if self.pc < len(self.instructions):
                next_if = self.instructions[self.pc]
                next_if_bubble = False
                self.pc += 1
            else:
                next_if = None
                next_if_bubble = True

        # Commit stage transitions
        self.stage_instructions["WB"] = next_wb
        self.is_bubble["WB"] = next_wb_bubble

        self.stage_instructions["MEM"] = next_mem
        self.is_bubble["MEM"] = next_mem_bubble

        self.stage_instructions["EX"] = next_ex
        self.is_bubble["EX"] = next_ex_bubble

        self.stage_instructions["ID"] = next_id
        self.is_bubble["ID"] = next_id_bubble

        self.stage_instructions["IF"] = next_if
        self.is_bubble["IF"] = next_if_bubble

        # Check if all stages are empty and PC is done
        all_empty = all(self.stage_instructions[s] is None for s in self.STAGES)
        if all_empty and self.pc >= len(self.instructions):
            self.is_completed = True

        state = self._build_state(
            [h.to_dict() for h in active_hazards],
            forwarding_events
        )
        self.history.append(state)
        return state

    def _build_state(
        self,
        active_hazards: List[Dict[str, Any]],
        forwarding_events: List[Dict[str, Any]]
    ) -> PipelineState:
        stages_dict: Dict[str, Optional[Dict[str, Any]]] = {}
        row_dict: Dict[str, str] = {}

        for s in self.STAGES:
            instr = self.stage_instructions[s]
            is_bub = self.is_bubble[s]
            if is_bub:
                stages_dict[s] = {"opcode": "BUBBLE", "raw": "stall / bubble", "is_bubble": True}
                row_dict[s] = "stall"
            elif instr is not None:
                d = instr.to_dict()
                d["is_bubble"] = False
                stages_dict[s] = d
                row_dict[s] = instr.opcode
            else:
                stages_dict[s] = None
                row_dict[s] = "empty"

        return PipelineState(
            cycle=self.cycle,
            stages=stages_dict,
            active_hazards=active_hazards,
            forwarding_events=forwarding_events,
            cumulative_hazards=self.cumulative_hazards.copy(),
            total_stalls=self.total_stalls,
            total_flushes=self.total_flushes,
            forwarding_enabled=self.forwarding_enabled,
            is_completed=self.is_completed,
            diagram_row=row_dict
        )

    def run_all(self, max_cycles: int = 200) -> List[PipelineState]:
        while not self.is_completed and self.cycle < max_cycles:
            self.step()
        return self.history
