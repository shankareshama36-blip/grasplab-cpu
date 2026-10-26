from typing import Dict, Any, List


class PerformanceCalculator:
    @staticmethod
    def calculate_cpi(cycles: int, instruction_count: int) -> float:
        if instruction_count <= 0:
            return 1.0
        return round(cycles / instruction_count, 3)

    @staticmethod
    def calculate_execution_time(
        instruction_count: int,
        cpi: float,
        clock_mhz: float = 1000.0  # 1 GHz default
    ) -> Dict[str, float]:
        """
        Calculates execution time:
        Time = (Instruction Count * CPI) / Clock Frequency (Hz)
        """
        clock_hz = clock_mhz * 1_000_000.0
        cycles = instruction_count * cpi
        seconds = cycles / clock_hz if clock_hz > 0 else 0.0
        nanoseconds = seconds * 1e9
        microseconds = seconds * 1e6
        milliseconds = seconds * 1e3

        return {
            "cycles": cycles,
            "seconds": seconds,
            "milliseconds": round(milliseconds, 4),
            "microseconds": round(microseconds, 3),
            "nanoseconds": round(nanoseconds, 2),
            "clock_mhz": clock_mhz,
            "cpi": round(cpi, 3),
            "instruction_count": instruction_count
        }

    @staticmethod
    def calculate_amdahl(
        parallel_fraction: float,
        speedup_factor: float
    ) -> Dict[str, Any]:
        """
        Amdahl's Law:
        Speedup = 1 / ((1 - p) + (p / s))
        Theoretical Max = 1 / (1 - p)
        """
        p = max(0.0, min(1.0, parallel_fraction))
        s = max(1.0, speedup_factor)

        denom = (1.0 - p) + (p / s)
        speedup = 1.0 / denom if denom > 0 else 1.0
        max_speedup = 1.0 / (1.0 - p) if (1.0 - p) > 0.00001 else float("inf")

        # Generate sample points for graph visualization (s = 1 to 32)
        curve_data = []
        for test_s in [1, 2, 4, 8, 16, 32, 64]:
            d = (1.0 - p) + (p / test_s)
            val = round(1.0 / d, 3)
            curve_data.append({"speedup_factor": test_s, "overall_speedup": val})

        return {
            "parallel_fraction": p,
            "speedup_factor": s,
            "overall_speedup": round(speedup, 3),
            "theoretical_max": round(max_speedup, 3) if max_speedup != float("inf") else 999.0,
            "curve": curve_data
        }

    @staticmethod
    def compare_pipelines(
        stages: int = 5,
        total_instructions: int = 100,
        hazard_stalls: int = 15
    ) -> Dict[str, Any]:
        """
        Compares 1-cycle CPU vs 5-stage pipelined CPU.
        """
        unpipelined_cpi = 1.0
        # In a single-cycle CPU with N stages worth of latency, clock frequency is 1/N.
        # In pipelined CPU: ideal cycles = instructions + stages - 1
        pipelined_ideal_cycles = total_instructions + stages - 1
        pipelined_actual_cycles = pipelined_ideal_cycles + hazard_stalls
        pipelined_cpi = pipelined_actual_cycles / total_instructions if total_instructions > 0 else 1.0

        # Speedup = (Time_unpipelined) / (Time_pipelined)
        # Time_unpipelined = N * instructions * t_stage
        # Time_pipelined = actual_cycles * t_stage
        speedup = (stages * total_instructions) / pipelined_actual_cycles if pipelined_actual_cycles > 0 else 1.0

        return {
            "stages": stages,
            "total_instructions": total_instructions,
            "hazard_stalls": hazard_stalls,
            "pipelined_cycles": pipelined_actual_cycles,
            "pipelined_cpi": round(pipelined_cpi, 3),
            "unpipelined_cpi": unpipelined_cpi,
            "speedup": round(speedup, 2),
            "pipeline_efficiency_percent": round((1.0 / pipelined_cpi) * 100, 1)
        }


class NumberSystems:
    @staticmethod
    def dec_to_bin(val: int, bits: int = 8) -> str:
        mask = (1 << bits) - 1
        return bin(val & mask)[2:].zfill(bits)

    @staticmethod
    def dec_to_hex(val: int, bits: int = 8) -> str:
        mask = (1 << bits) - 1
        hex_digits = (bits + 3) // 4
        return "0x" + hex(val & mask)[2:].upper().zfill(hex_digits)

    @staticmethod
    def bin_to_dec(bin_str: str, signed: bool = True) -> int:
        clean = bin_str.strip().replace(" ", "")
        if not clean:
            return 0
        bits = len(clean)
        val = int(clean, 2)
        if signed and (val & (1 << (bits - 1))):
            val -= (1 << bits)
        return val

    @staticmethod
    def twos_complement_breakdown(val: int, bits: int = 8) -> Dict[str, Any]:
        """
        Generates step-by-step breakdown of two's complement conversion.
        """
        val = max(-(1 << (bits - 1)), min((1 << (bits - 1)) - 1, val))
        abs_val = abs(val)
        raw_bin = bin(abs_val)[2:].zfill(bits)

        if val >= 0:
            return {
                "input": val,
                "bits": bits,
                "is_negative": False,
                "magnitude_binary": raw_bin,
                "inverted_binary": None,
                "twos_complement_binary": raw_bin,
                "hex": NumberSystems.dec_to_hex(val, bits),
                "steps": [
                    f"Number {val} is non-negative.",
                    f"Direct binary representation in {bits} bits: {raw_bin}."
                ]
            }

        # Negative value
        inverted_bin = "".join("1" if b == "0" else "0" for b in raw_bin)
        twos_comp_int = (int(inverted_bin, 2) + 1) & ((1 << bits) - 1)
        twos_comp_bin = bin(twos_comp_int)[2:].zfill(bits)

        return {
            "input": val,
            "bits": bits,
            "is_negative": True,
            "magnitude_binary": raw_bin,
            "inverted_binary": inverted_bin,
            "twos_complement_binary": twos_comp_bin,
            "hex": NumberSystems.dec_to_hex(twos_comp_int, bits),
            "steps": [
                f"1. Take absolute value |{val}| = {abs_val}.",
                f"2. Convert magnitude to {bits}-bit binary: {raw_bin}.",
                f"3. Invert all bits (One's Complement): {inverted_bin}.",
                f"4. Add 1 to inverted bits: {twos_comp_bin}.",
                f"5. The most significant bit (MSB) is 1, indicating a negative signed integer."
            ]
        }

    @staticmethod
    def bitwise_operation(op: str, val1: int, val2: int = 0, bits: int = 8) -> Dict[str, Any]:
        op = op.upper()
        mask = (1 << bits) - 1
        v1 = val1 & mask
        v2 = val2 & mask

        if op == "AND":
            res = v1 & v2
        elif op == "OR":
            res = v1 | v2
        elif op == "XOR":
            res = v1 ^ v2
        elif op == "NOT":
            res = (~v1) & mask
        elif op == "SHL":
            shift = val2 % bits
            res = (v1 << shift) & mask
        elif op == "SHR":
            shift = val2 % bits
            res = (v1 >> shift) & mask
        else:
            res = 0

        b1 = bin(v1)[2:].zfill(bits)
        b2 = bin(v2)[2:].zfill(bits)
        bres = bin(res)[2:].zfill(bits)

        bit_breakdown = []
        for i in range(bits):
            bit_idx = bits - 1 - i
            bit_breakdown.append({
                "bit_position": bit_idx,
                "input1": int(b1[i]),
                "input2": int(b2[i]) if op != "NOT" else None,
                "output": int(bres[i])
            })

        return {
            "operation": op,
            "val1": val1,
            "val2": val2,
            "bits": bits,
            "binary_in1": b1,
            "binary_in2": b2 if op != "NOT" else None,
            "binary_out": bres,
            "decimal_out": res,
            "hex_out": NumberSystems.dec_to_hex(res, bits),
            "bit_breakdown": bit_breakdown
        }
