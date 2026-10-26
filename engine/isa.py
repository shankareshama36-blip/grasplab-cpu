from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List

CANONICAL_REGISTERS = [f"R{i}" for i in range(8)]

PRESETS = ["RISC-V", "MIPS", "x86"]

# Register aliases mapped to canonical R0..R7
REGISTER_MAPS: Dict[str, Dict[str, str]] = {
    "RISC-V": {
        "x0": "R0", "zero": "R0",
        "x1": "R1", "ra": "R1",
        "x2": "R2", "sp": "R2",
        "x3": "R3", "gp": "R3",
        "x4": "R4", "tp": "R4",
        "x5": "R5", "t0": "R5",
        "x6": "R6", "t1": "R6",
        "x7": "R7", "t2": "R7",
    },
    "MIPS": {
        "$zero": "R0", "$0": "R0",
        "$t0": "R1", "$8": "R1",
        "$t1": "R2", "$9": "R2",
        "$t2": "R3", "$10": "R3",
        "$t3": "R4", "$11": "R4",
        "$s0": "R5", "$16": "R5",
        "$s1": "R6", "$17": "R6",
        "$ra": "R7", "$31": "R7",
    },
    "x86": {
        "eax": "R0", "ax": "R0", "al": "R0",
        "ebx": "R1", "bx": "R1", "bl": "R1",
        "ecx": "R2", "cx": "R2", "cl": "R2",
        "edx": "R3", "dx": "R3", "dl": "R3",
        "esi": "R4", "si": "R4",
        "edi": "R5", "di": "R5",
        "ebp": "R6", "bp": "R6",
        "esp": "R7", "sp": "R7",
    }
}

# Opcode aliases mapped to canonical opcodes
OPCODE_MAPS: Dict[str, Dict[str, str]] = {
    "RISC-V": {
        "lw": "LOAD",
        "sw": "STORE",
        "li": "LOAD",
        "mv": "MOV",
        "add": "ADD",
        "addi": "ADDI",
        "sub": "SUB",
        "and": "AND",
        "andi": "AND",
        "or": "OR",
        "ori": "OR",
        "xor": "XOR",
        "xori": "XOR",
        "mul": "MUL",
        "beq": "BEQ",
        "bne": "BNE",
        "blt": "BLT",
        "bgt": "BGT",
        "j": "JMP",
        "jal": "JMP",
        "nop": "NOP",
        "halt": "HALT",
        "ebreak": "HALT",
    },
    "MIPS": {
        "lw": "LOAD",
        "sw": "STORE",
        "li": "LOAD",
        "move": "MOV",
        "add": "ADD",
        "addu": "ADD",
        "addi": "ADDI",
        "addiu": "ADDI",
        "sub": "SUB",
        "subu": "SUB",
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "mult": "MUL",
        "mul": "MUL",
        "beq": "BEQ",
        "bne": "BNE",
        "j": "JMP",
        "nop": "NOP",
        "halt": "HALT",
        "syscall": "HALT",
    },
    "x86": {
        "mov": "MOV",
        "add": "ADD",
        "sub": "SUB",
        "imul": "MUL",
        "mul": "MUL",
        "and": "AND",
        "or": "OR",
        "xor": "XOR",
        "jmp": "JMP",
        "jz": "BRZ",
        "je": "BRZ",
        "jnz": "BRNZ",
        "jne": "BRNZ",
        "nop": "NOP",
        "hlt": "HALT",
        "halt": "HALT",
    }
}

VALID_OPCODES = {
    "LOAD", "STORE", "MOV",
    "ADD", "ADDI", "SUB", "MUL", "AND", "OR", "XOR",
    "BRZ", "BRNZ", "BEQ", "BNE", "BLT", "BGT", "JMP",
    "NOP", "HALT"
}


@dataclass
class Instruction:
    opcode: str
    rd: Optional[str] = None          # Destination register (e.g. "R1")
    rs1: Optional[str] = None         # Source operand 1 (e.g. "R2")
    rs2: Optional[str] = None         # Source operand 2 (e.g. "R3")
    imm: Optional[int] = None         # Immediate constant or memory offset
    mem_addr: Optional[int] = None    # Direct memory address (e.g., [100])
    mem_base_reg: Optional[str] = None # Base register for indexed memory [R1]
    label: Optional[str] = None       # Target label (e.g. "LOOP")
    target_pc: Optional[int] = None   # Resolved target instruction index
    raw: str = ""                     # Original assembly line
    line_no: int = 0                  # 1-based source line

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @property
    def is_branch_or_jump(self) -> bool:
        return self.opcode in {"BRZ", "BRNZ", "BEQ", "BNE", "BLT", "BGT", "JMP"}

    @property
    def writes_register(self) -> bool:
        if self.opcode in {"STORE", "BRZ", "BRNZ", "BEQ", "BNE", "BLT", "BGT", "JMP", "NOP", "HALT"}:
            return False
        return self.rd is not None

    @property
    def reads_registers(self) -> List[str]:
        regs = []
        if self.rs1:
            regs.append(self.rs1)
        if self.rs2:
            regs.append(self.rs2)
        if self.mem_base_reg:
            regs.append(self.mem_base_reg)
        if self.opcode == "STORE" and self.rd:
            # In STORE R2, [100] or STORE [100], R2: R2 is source data being written to memory
            regs.append(self.rd)
        elif self.opcode in {"BRZ", "BRNZ"} and self.rd:
            # BRZ R1, TARGET: R1 is tested
            regs.append(self.rd)
        return list(dict.fromkeys(regs))
