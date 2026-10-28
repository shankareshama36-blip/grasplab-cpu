export type Role = 'Student' | 'Instructor';

export interface User {
  id: number;
  email: string;
  role: Role;
  tenant_id: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Program {
  id: number;
  tenant_id: string;
  name: string;
  assembly_source: string;
  isa_preset: string;
  status: string;
  created_at: string;
}

export interface InstructionData {
  opcode: string;
  rd?: string | null;
  rs1?: string | null;
  rs2?: string | null;
  imm?: number | null;
  mem_addr?: number | null;
  mem_base_reg?: string | null;
  label?: string | null;
  target_pc?: number | null;
  raw: string;
  line_no: number;
  is_bubble?: boolean;
}

export interface BusActivity {
  alu_op: string | null;
  alu_in1: number | null;
  alu_in2: number | null;
  alu_out: number | null;
  mem_read: boolean;
  mem_write: boolean;
  reg_write: boolean;
  branch_taken: boolean;
}

export interface CPUState {
  pc: number;
  next_pc: number;
  registers: Record<string, number>;
  memory: Record<string, number>;
  flags: { Z: boolean; N: boolean };
  current_instruction: InstructionData | null;
  cycles: number;
  instruction_count: number;
  status: 'READY' | 'RUNNING' | 'HALTED' | 'ERROR';
  log: string[];
  bus_activity: BusActivity;
}

export interface HazardData {
  hazard_type: 'data' | 'control' | 'structural';
  description: string;
  affected_registers: string[];
  source_stage: string;
  target_stage: string;
  resolved_by: 'forwarding' | 'stall' | 'flush' | 'dual_port_simulated';
}

export interface ForwardingEvent {
  from_stage: string;
  to_stage: string;
  register: string;
  description: string;
}

export interface PipelineState {
  cycle: number;
  stages: {
    IF: InstructionData | null;
    ID: InstructionData | null;
    EX: InstructionData | null;
    MEM: InstructionData | null;
    WB: InstructionData | null;
  };
  active_hazards: HazardData[];
  forwarding_events: ForwardingEvent[];
  cumulative_hazards: {
    data: number;
    control: number;
    structural: number;
  };
  total_stalls: number;
  total_flushes: number;
  forwarding_enabled: boolean;
  is_completed: boolean;
  diagram_row: Record<string, string>;
}

export interface RunResult {
  run_id: number;
  program_id: number;
  cycles: number;
  effective_cycles?: number;
  pipeline_cycles?: number;
  instruction_count: number;
  cpi: number;
  performance: {
    cycles: number;
    seconds: number;
    milliseconds: number;
    microseconds: number;
    nanoseconds: number;
    clock_mhz: number;
    cpi: number;
    instruction_count: number;
  };
  pipeline_comparison: {
    stages: number;
    total_instructions: number;
    hazard_stalls: number;
    pipelined_cycles: number;
    pipelined_cpi: number;
    unpipelined_cpi: number;
    speedup: number;
    pipeline_efficiency_percent: number;
  };
  forwarding_comparison?: {
    forwarding_on: {
      stalls: number;
      flushes: number;
      cpi: number;
      pipeline_cycles: number;
    };
    forwarding_off: {
      stalls: number;
      flushes: number;
      cpi: number;
      pipeline_cycles: number;
    };
    stalls_saved: number;
  };
  hazards: {
    data: number;
    control: number;
    structural: number;
    total_stalls: number;
    total_flushes: number;
  };
  final_cpu_state: CPUState;
  cpu_trace: CPUState[];
  pipeline_trace: PipelineState[];
}

export interface InstructorProgram {
  id: number;
  name: string;
  assembly_source?: string;
  isa_preset: string;
  status: string;
  created_at: string;
  has_hazard_flags: boolean;
  runs_count: number;
  latest_run?: {
    id: number;
    cycles: number;
    cpi: number;
    hazards: Record<string, any>;
    created_at: string;
  };
  runs: Array<{
    id: number;
    cycles: number;
    cpi: number;
    hazards: Record<string, any>;
    created_at: string;
  }>;
}
