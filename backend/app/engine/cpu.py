from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from app.engine.isa import Instruction, CANONICAL_REGISTERS


@dataclass
class CPUState:
    pc: int
    next_pc: int
    registers: Dict[str, int]
    memory: Dict[int, int]
    flags: Dict[str, bool]
    current_instruction: Optional[Dict[str, Any]]
    cycles: int
    instruction_count: int
    status: str  # "READY", "RUNNING", "HALTED", "ERROR"
    log: List[str]
    bus_activity: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CPU:
    def __init__(
        self,
        instructions: List[Instruction],
        initial_memory: Optional[Dict[int, int]] = None
    ):
        self.instructions = instructions
        self.pc = 0
        self.cycles = 0
        self.instruction_count = 0
        self.status = "READY"
        self.registers: Dict[str, int] = {f"R{i}": 0 for i in range(8)}
        self.memory: Dict[int, int] = initial_memory.copy() if initial_memory else {}
        self.flags: Dict[str, bool] = {"Z": False, "N": False}
        self.logs: List[str] = []
        self.latest_bus: Dict[str, Any] = {
            "alu_op": None,
            "alu_in1": None,
            "alu_in2": None,
            "alu_out": None,
            "mem_read": False,
            "mem_write": False,
            "reg_write": False,
            "branch_taken": False
        }

    def reset(self):
        self.pc = 0
        self.cycles = 0
        self.instruction_count = 0
        self.status = "READY"
        self.registers = {f"R{i}": 0 for i in range(8)}
        self.memory.clear()
        self.flags = {"Z": False, "N": False}
        self.logs.clear()
        self.latest_bus = {
            "alu_op": None,
            "alu_in1": None,
            "alu_in2": None,
            "alu_out": None,
            "mem_read": False,
            "mem_write": False,
            "reg_write": False,
            "branch_taken": False
        }

    def _update_flags(self, value: int):
        self.flags["Z"] = (value == 0)
        self.flags["N"] = (value < 0)

    def get_state(self, current_instr: Optional[Instruction] = None, next_pc: Optional[int] = None) -> CPUState:
        return CPUState(
            pc=self.pc,
            next_pc=next_pc if next_pc is not None else self.pc,
            registers=self.registers.copy(),
            memory=self.memory.copy(),
            flags=self.flags.copy(),
            current_instruction=current_instr.to_dict() if current_instr else None,
            cycles=self.cycles,
            instruction_count=self.instruction_count,
            status=self.status,
            log=list(self.logs),
            bus_activity=self.latest_bus.copy()
        )

    def step(self) -> CPUState:
        if self.status == "HALTED":
            return self.get_state()

        if self.pc < 0 or self.pc >= len(self.instructions):
            self.status = "HALTED"
            self.logs.append(f"Cycle {self.cycles}: Reached end of instructions (PC={self.pc}).")
            return self.get_state()

        self.status = "RUNNING"
        instr = self.instructions[self.pc]
        next_pc = self.pc + 1
        self.cycles += 1
        self.instruction_count += 1

        bus = {
            "alu_op": None,
            "alu_in1": None,
            "alu_in2": None,
            "alu_out": None,
            "mem_read": False,
            "mem_write": False,
            "reg_write": False,
            "branch_taken": False
        }

        op = instr.opcode

        if op == "HALT":
            self.status = "HALTED"
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: HALT executed.")

        elif op == "NOP":
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: NOP.")

        elif op == "LOAD":
            bus["reg_write"] = True
            if instr.mem_addr is not None:
                # Direct memory load: LOAD R1, [100]
                bus["mem_read"] = True
                val = self.memory.get(instr.mem_addr, 0)
                self.registers[instr.rd] = val
                self._update_flags(val)
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: LOAD {instr.rd} = MEM[{instr.mem_addr}] ({val})")
            elif instr.mem_base_reg is not None:
                # Base + offset memory load: LOAD R1, [R2] or 4(R2)
                bus["mem_read"] = True
                base = self.registers.get(instr.mem_base_reg, 0)
                addr = base + (instr.imm or 0)
                val = self.memory.get(addr, 0)
                self.registers[instr.rd] = val
                self._update_flags(val)
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: LOAD {instr.rd} = MEM[{addr}] ({val})")
            elif instr.imm is not None:
                # Immediate constant load: LOAD R1, 10
                self.registers[instr.rd] = instr.imm
                self._update_flags(instr.imm)
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: LOAD {instr.rd} = {instr.imm}")

        elif op == "STORE":
            bus["mem_write"] = True
            val = self.registers.get(instr.rd, 0)
            if instr.mem_addr is not None:
                addr = instr.mem_addr
            elif instr.mem_base_reg is not None:
                base = self.registers.get(instr.mem_base_reg, 0)
                addr = base + (instr.imm or 0)
            else:
                addr = 0
            self.memory[addr] = val
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: STORE {instr.rd} ({val}) -> MEM[{addr}]")

        elif op == "MOV":
            bus["reg_write"] = True
            val = self.registers.get(instr.rs1, 0)
            self.registers[instr.rd] = val
            self._update_flags(val)
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: MOV {instr.rd} = {instr.rs1} ({val})")

        elif op in {"ADD", "SUB", "MUL", "AND", "OR", "XOR"}:
            bus["reg_write"] = True
            bus["alu_op"] = op
            v1 = self.registers.get(instr.rs1, 0)
            v2 = self.registers.get(instr.rs2, 0)
            bus["alu_in1"] = v1
            bus["alu_in2"] = v2

            if op == "ADD":
                res = v1 + v2
            elif op == "SUB":
                res = v1 - v2
            elif op == "MUL":
                res = v1 * v2
            elif op == "AND":
                res = v1 & v2
            elif op == "OR":
                res = v1 | v2
            elif op == "XOR":
                res = v1 ^ v2
            else:
                res = 0

            bus["alu_out"] = res
            self.registers[instr.rd] = res
            self._update_flags(res)
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: {op} {instr.rd} = {v1} {op} {v2} -> {res}")

        elif op == "ADDI":
            bus["reg_write"] = True
            bus["alu_op"] = "ADD"
            v1 = self.registers.get(instr.rs1, 0)
            imm = instr.imm or 0
            res = v1 + imm
            bus["alu_in1"] = v1
            bus["alu_in2"] = imm
            bus["alu_out"] = res
            self.registers[instr.rd] = res
            self._update_flags(res)
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: ADDI {instr.rd} = {v1} + {imm} -> {res}")

        elif op == "JMP":
            target = instr.target_pc if instr.target_pc is not None else next_pc
            next_pc = target
            bus["branch_taken"] = True
            self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: JMP to PC={next_pc}")

        elif op in {"BRZ", "BRNZ"}:
            reg_val = self.registers.get(instr.rd, 0) if instr.rd else (0 if self.flags["Z"] else 1)
            condition = (reg_val == 0) if op == "BRZ" else (reg_val != 0)
            if condition:
                next_pc = instr.target_pc if instr.target_pc is not None else next_pc
                bus["branch_taken"] = True
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: {op} taken -> Jump to PC={next_pc}")
            else:
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: {op} not taken (val={reg_val})")

        elif op in {"BEQ", "BNE", "BLT", "BGT"}:
            v1 = self.registers.get(instr.rs1, 0)
            v2 = self.registers.get(instr.rs2, 0)
            cond = False
            if op == "BEQ":
                cond = (v1 == v2)
            elif op == "BNE":
                cond = (v1 != v2)
            elif op == "BLT":
                cond = (v1 < v2)
            elif op == "BGT":
                cond = (v1 > v2)

            if cond:
                next_pc = instr.target_pc if instr.target_pc is not None else next_pc
                bus["branch_taken"] = True
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: {op} taken ({v1} vs {v2}) -> Jump to PC={next_pc}")
            else:
                self.logs.append(f"Cycle {self.cycles} [PC={self.pc}]: {op} not taken ({v1} vs {v2})")

        self.latest_bus = bus
        state = self.get_state(current_instr=instr, next_pc=next_pc)
        self.pc = next_pc

        if self.pc >= len(self.instructions) and self.status != "HALTED":
            self.status = "HALTED"

        return state

    def run(self, max_cycles: int = 500) -> List[CPUState]:
        states: List[CPUState] = []
        while self.status != "HALTED" and self.cycles < max_cycles:
            state = self.step()
            states.append(state)
        return states
