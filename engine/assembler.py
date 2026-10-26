import re
from typing import List, Dict, Tuple, Optional, Any
from engine.isa import (
    Instruction,
    CANONICAL_REGISTERS,
    PRESETS,
    REGISTER_MAPS,
    OPCODE_MAPS,
    VALID_OPCODES,
)


class AssemblyError(Exception):
    def __init__(self, message: str, line_no: int = 0, raw_line: str = ""):
        self.message = message
        self.line_no = line_no
        self.raw_line = raw_line
        super().__init__(f"Line {line_no}: {message} -> '{raw_line.strip()}'" if line_no else message)


class Assembler:
    def __init__(self, preset: str = "RISC-V"):
        self.preset = preset if preset in PRESETS else "RISC-V"
        self.reg_map = REGISTER_MAPS.get(self.preset, {})
        self.op_map = OPCODE_MAPS.get(self.preset, {})

    def normalize_register(self, token: str) -> Optional[str]:
        cleaned = token.strip().rstrip(",").lower()
        if not cleaned:
            return None

        # Check standard canonical R0..R7
        upper = cleaned.upper()
        if upper in CANONICAL_REGISTERS:
            return upper

        # Check preset alias
        if cleaned in self.reg_map:
            return self.reg_map[cleaned]

        # Check if user passed r0..r7 lowercase
        if cleaned.startswith("r") and cleaned[1:].isdigit():
            idx = int(cleaned[1:])
            if 0 <= idx < 8:
                return f"R{idx}"

        return None

    def normalize_opcode(self, token: str) -> str:
        cleaned = token.strip().lower()
        upper = cleaned.upper()
        if upper in VALID_OPCODES:
            return upper
        if cleaned in self.op_map:
            return self.op_map[cleaned]
        return upper

    def parse_memory_operand(self, token: str) -> Tuple[Optional[int], Optional[str], Optional[int]]:
        """
        Parses memory operand syntax:
        - [100] -> mem_addr=100, base_reg=None, imm_offset=None
        - [R1] -> mem_addr=None, base_reg="R1", imm_offset=0
        - [R1+4] / [R1-4] -> mem_addr=None, base_reg="R1", imm_offset=4
        - 4(R1) or 4($t0) -> mem_addr=None, base_reg="R1", imm_offset=4
        """
        token = token.strip().rstrip(",")

        # Format: 4(R1) or 0($t0)
        m_offset_base = re.match(r"^([+-]?\d+)\((.+)\)$", token)
        if m_offset_base:
            offset = int(m_offset_base.group(1))
            reg = self.normalize_register(m_offset_base.group(2))
            return None, reg, offset

        # Format: [ ... ]
        if token.startswith("[") and token.endswith("]"):
            inner = token[1:-1].strip()
            # Direct integer address: [100]
            if re.match(r"^[+-]?\d+$", inner):
                return int(inner), None, None
            # [R1]
            reg = self.normalize_register(inner)
            if reg:
                return None, reg, 0
            # [R1+4] or [R1-4]
            m_bracket_offset = re.match(r"^([A-Za-z0-9$]+)\s*([+-])\s*(\d+)$", inner)
            if m_bracket_offset:
                reg = self.normalize_register(m_bracket_offset.group(1))
                sign = -1 if m_bracket_offset.group(2) == "-" else 1
                off = sign * int(m_bracket_offset.group(3))
                return None, reg, off

        return None, None, None

    def parse_integer(self, token: str) -> Optional[int]:
        cleaned = token.strip().rstrip(",")
        if cleaned.startswith("$") and not cleaned.startswith("$t") and not cleaned.startswith("$s"):
            # Hex or immediate like $10 or $0xFF
            cleaned = cleaned[1:]
        try:
            if cleaned.lower().startswith("0x"):
                return int(cleaned, 16)
            elif cleaned.lower().startswith("0b"):
                return int(cleaned, 2)
            else:
                return int(cleaned, 10)
        except ValueError:
            return None

    def strip_comment(self, line: str) -> str:
        for delim in (";", "//", "#"):
            if delim in line:
                line = line.split(delim, 1)[0]
        return line.strip()

    def assemble(self, source: str) -> Tuple[List[Instruction], Dict[str, int]]:
        lines = source.splitlines()
        instructions: List[Instruction] = []
        labels: Dict[str, int] = {}
        pending_labels: List[str] = []

        # Pass 1: Collect labels and raw instructions
        intermediate: List[Tuple[int, str, List[str], str]] = []  # (line_no, opcode, operands, raw)

        for line_no, raw_line in enumerate(lines, start=1):
            cleaned = self.strip_comment(raw_line)
            if not cleaned:
                continue

            # Check for label at start: e.g. "LOOP:" or "START: LOAD R1, 1"
            while ":" in cleaned:
                prefix, remainder = cleaned.split(":", 1)
                label_name = prefix.strip()
                if not label_name or " " in label_name:
                    break
                pending_labels.append(label_name.upper())
                cleaned = remainder.strip()

            if not cleaned:
                continue

            # Tokenize into opcode + comma-separated operands
            parts = cleaned.split(None, 1)
            opcode_raw = parts[0]
            canonical_opcode = self.normalize_opcode(opcode_raw)

            operands: List[str] = []
            if len(parts) > 1:
                # Split operands by comma while preserving brackets/parentheses
                op_str = parts[1].strip()
                # Split on comma not within [] or ()
                tokens = [t.strip() for t in re.split(r",(?![^\[]*\])(?![^\(]*\))", op_str) if t.strip()]
                operands = tokens

            curr_idx = len(intermediate)
            for lbl in pending_labels:
                labels[lbl] = curr_idx
            pending_labels.clear()

            intermediate.append((line_no, canonical_opcode, operands, raw_line))

        # Any trailing label points to the end of program (index = len(intermediate))
        for lbl in pending_labels:
            labels[lbl] = len(intermediate)

        # Pass 2: Parse operand semantics and build Instruction objects
        for idx, (line_no, opcode, operands, raw_line) in enumerate(intermediate):
            instr = Instruction(
                opcode=opcode,
                raw=raw_line.strip(),
                line_no=line_no
            )

            if opcode == "HALT":
                pass
            elif opcode == "NOP":
                pass

            elif opcode in {"JMP", "J"}:
                if not operands:
                    raise AssemblyError("JMP requires target label or address", line_no, raw_line)
                target = operands[0].strip().upper()
                instr.label = target

            elif opcode in {"BRZ", "BRNZ"}:
                # Syntax: BRZ R1, TARGET or BRZ TARGET (if implied flag)
                if len(operands) == 1:
                    instr.label = operands[0].strip().upper()
                elif len(operands) >= 2:
                    reg = self.normalize_register(operands[0])
                    if reg:
                        instr.rd = reg
                        instr.label = operands[1].strip().upper()
                    else:
                        raise AssemblyError(f"Invalid condition register in {opcode}", line_no, raw_line)
                else:
                    raise AssemblyError(f"{opcode} requires target", line_no, raw_line)

            elif opcode in {"BEQ", "BNE", "BLT", "BGT"}:
                # Syntax: BEQ R1, R2, TARGET
                if len(operands) < 3:
                    raise AssemblyError(f"{opcode} requires two source registers and target label", line_no, raw_line)
                r1 = self.normalize_register(operands[0])
                r2 = self.normalize_register(operands[1])
                if not r1 or not r2:
                    raise AssemblyError(f"Invalid registers in {opcode}", line_no, raw_line)
                instr.rs1 = r1
                instr.rs2 = r2
                instr.label = operands[2].strip().upper()

            elif opcode == "LOAD":
                # Syntax:
                # LOAD R1, 100        -> Immediate
                # LOAD R1, [100]      -> Direct Memory
                # LOAD R1, [R2]       -> Base register
                # LOAD R1, 4(R2)      -> Base + offset
                if len(operands) < 2:
                    raise AssemblyError("LOAD requires destination and source", line_no, raw_line)
                rd = self.normalize_register(operands[0])
                if not rd:
                    raise AssemblyError(f"Invalid destination register '{operands[0]}'", line_no, raw_line)
                instr.rd = rd

                mem_addr, base_reg, off = self.parse_memory_operand(operands[1])
                if mem_addr is not None:
                    instr.mem_addr = mem_addr
                elif base_reg is not None:
                    instr.mem_base_reg = base_reg
                    instr.imm = off or 0
                else:
                    imm_val = self.parse_integer(operands[1])
                    if imm_val is not None:
                        instr.imm = imm_val
                    else:
                        # Could be a label or variable
                        instr.label = operands[1].strip().upper()

            elif opcode == "STORE":
                # Syntax:
                # STORE R2, [100]     -> rd=R2, mem_addr=100
                # STORE [100], R2     -> rd=R2, mem_addr=100 (x86 style)
                # STORE R2, [R1]      -> rd=R2, mem_base_reg=R1
                # STORE R2, 4(R1)     -> rd=R2, mem_base_reg=R1, imm=4
                if len(operands) < 2:
                    raise AssemblyError("STORE requires source register and memory target", line_no, raw_line)

                # Check if first operand is memory or register
                mem_addr1, base_reg1, off1 = self.parse_memory_operand(operands[0])
                if mem_addr1 is not None or base_reg1 is not None:
                    # STORE [100], R2
                    rd = self.normalize_register(operands[1])
                    if not rd:
                        raise AssemblyError("STORE target data must be a register", line_no, raw_line)
                    instr.rd = rd
                    instr.mem_addr = mem_addr1
                    instr.mem_base_reg = base_reg1
                    instr.imm = off1
                else:
                    # STORE R2, [100]
                    rd = self.normalize_register(operands[0])
                    if not rd:
                        raise AssemblyError("STORE source must be a register", line_no, raw_line)
                    instr.rd = rd
                    mem_addr2, base_reg2, off2 = self.parse_memory_operand(operands[1])
                    if mem_addr2 is not None:
                        instr.mem_addr = mem_addr2
                    elif base_reg2 is not None:
                        instr.mem_base_reg = base_reg2
                        instr.imm = off2 or 0
                    else:
                        imm_addr = self.parse_integer(operands[1])
                        if imm_addr is not None:
                            instr.mem_addr = imm_addr
                        else:
                            raise AssemblyError(f"Invalid memory target '{operands[1]}'", line_no, raw_line)

            elif opcode == "MOV":
                # MOV R1, R2 or MOV R1, 10
                if len(operands) < 2:
                    raise AssemblyError("MOV requires destination and source", line_no, raw_line)
                rd = self.normalize_register(operands[0])
                if not rd:
                    raise AssemblyError("MOV destination must be a register", line_no, raw_line)
                instr.rd = rd

                rs = self.normalize_register(operands[1])
                if rs:
                    instr.rs1 = rs
                else:
                    imm = self.parse_integer(operands[1])
                    if imm is not None:
                        instr.opcode = "LOAD"
                        instr.imm = imm
                    else:
                        raise AssemblyError(f"Invalid MOV source '{operands[1]}'", line_no, raw_line)

            elif opcode in {"ADD", "SUB", "MUL", "AND", "OR", "XOR"}:
                # 3-operand: ADD R1, R2, R3 (R1 = R2 + R3)
                # 2-operand: ADD R1, R2 (R1 = R1 + R2)
                if len(operands) == 3:
                    rd = self.normalize_register(operands[0])
                    rs1 = self.normalize_register(operands[1])
                    rs2 = self.normalize_register(operands[2])
                    if not rd or not rs1:
                        raise AssemblyError(f"Invalid registers in {opcode}", line_no, raw_line)
                    instr.rd = rd
                    instr.rs1 = rs1
                    if rs2:
                        instr.rs2 = rs2
                    else:
                        # Immediate operand in 3-operand instruction e.g. ADD R1, R2, 5
                        imm = self.parse_integer(operands[2])
                        if imm is not None:
                            instr.opcode = "ADDI" if opcode == "ADD" else opcode
                            instr.imm = imm
                        else:
                            raise AssemblyError(f"Invalid 3rd operand '{operands[2]}'", line_no, raw_line)
                elif len(operands) == 2:
                    rd = self.normalize_register(operands[0])
                    if not rd:
                        raise AssemblyError(f"Invalid destination register in {opcode}", line_no, raw_line)
                    instr.rd = rd
                    instr.rs1 = rd
                    rs2 = self.normalize_register(operands[1])
                    if rs2:
                        instr.rs2 = rs2
                    else:
                        imm = self.parse_integer(operands[1])
                        if imm is not None:
                            instr.opcode = "ADDI" if opcode == "ADD" else opcode
                            instr.imm = imm
                        else:
                            raise AssemblyError(f"Invalid 2nd operand '{operands[1]}'", line_no, raw_line)
                else:
                    raise AssemblyError(f"{opcode} requires 2 or 3 operands", line_no, raw_line)

            elif opcode == "ADDI":
                # ADDI R1, R2, 10 or ADDI R1, 10
                if len(operands) == 3:
                    rd = self.normalize_register(operands[0])
                    rs1 = self.normalize_register(operands[1])
                    imm = self.parse_integer(operands[2])
                    if not rd or not rs1 or imm is None:
                        raise AssemblyError("ADDI requires rd, rs, immediate", line_no, raw_line)
                    instr.rd = rd
                    instr.rs1 = rs1
                    instr.imm = imm
                elif len(operands) == 2:
                    rd = self.normalize_register(operands[0])
                    imm = self.parse_integer(operands[1])
                    if not rd or imm is None:
                        raise AssemblyError("ADDI requires rd, immediate", line_no, raw_line)
                    instr.rd = rd
                    instr.rs1 = rd
                    instr.imm = imm
                else:
                    raise AssemblyError("ADDI format invalid", line_no, raw_line)

            else:
                raise AssemblyError(f"Unknown or unsupported instruction '{opcode}'", line_no, raw_line)

            # Resolve target_pc if label exists
            if instr.label:
                lbl_upper = instr.label.upper()
                if lbl_upper in labels:
                    instr.target_pc = labels[lbl_upper]
                else:
                    # Check if integer PC was given directly
                    direct_pc = self.parse_integer(instr.label)
                    if direct_pc is not None:
                        instr.target_pc = direct_pc
                    else:
                        raise AssemblyError(f"Undefined label '{instr.label}'", line_no, raw_line)

            instructions.append(instr)

        return instructions, labels
