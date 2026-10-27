import React, { useState, useEffect, useRef } from 'react';
import { Program, CPUState } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface BuildTabProps {
  currentProgram: Program | null;
  onProgramUpdate: (prog: Program) => void;
  onRunSuccess?: () => void;
}

const SAMPLE_PROGRAMS: Record<string, { name: string; preset: string; code: string }> = {
  array_sum: {
    name: 'Array Sum with Branch',
    preset: 'RISC-V',
    code: `; Array Sum with Branch
; Calculates sum of numbers 3, 2, 1 using a counter loop
LOAD R1, 3        ; R1 = counter (number of iterations)
LOAD R2, 0        ; R2 = accumulator (sum)
LOAD R3, 1        ; R3 = decrement step
LOOP:
ADD R2, R2, R1    ; sum = sum + counter
SUB R1, R1, R3    ; counter = counter - 1
BRNZ R1, LOOP     ; branch to LOOP if counter != 0
STORE R2, [100]   ; write final sum to memory address 100
HALT              ; terminate execution
`,
  },
  factorial: {
    name: 'Factorial of 4 (4! = 24)',
    preset: 'RISC-V',
    code: `; Factorial Calculator
LOAD R1, 4        ; R1 = N (4)
LOAD R2, 1        ; R2 = result (factorial)
LOAD R3, 1        ; R3 = step
FACT_LOOP:
MUL R2, R2, R1    ; result = result * N
SUB R1, R1, R3    ; N = N - 1
BRNZ R1, FACT_LOOP; loop until N == 0
STORE R2, [150]   ; store 24 at address 150
HALT
`,
  },
  memory_copy: {
    name: 'Memory Block Copy',
    preset: 'MIPS',
    code: `; Memory Copy from Addr 10 to Addr 20
LOAD R1, 42       ; test data
STORE R1, [10]    ; write data to address 10
LOAD R2, [10]     ; read data back into R2
STORE R2, [20]    ; store data into address 20
HALT
`,
  },
  x86_counter: {
    name: 'x86 Arithmetic Accumulator',
    preset: 'x86',
    code: `; x86 Arithmetic Loop
mov eax, 10
mov ebx, 2
add eax, ebx
mov [200], eax
hlt
`,
  },
};

export const BuildTab: React.FC<BuildTabProps> = ({ currentProgram, onProgramUpdate }) => {
  const { showToast } = useToast();
  const [sourceCode, setSourceCode] = useState<string>('');
  const [preset, setPreset] = useState<string>('RISC-V');
  const [programName, setProgramName] = useState<string>('');

  // Simulation State
  const [cpuState, setCpuState] = useState<CPUState | null>(null);
  const [prevCpuState, setPrevCpuState] = useState<CPUState | null>(null);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [memoryFilter, setMemoryFilter] = useState<string>('');

  // Editor Line Numbers Sync
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const handleEditorScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    if (currentProgram) {
      setSourceCode(currentProgram.assembly_source);
      setPreset(currentProgram.isa_preset || 'RISC-V');
      setProgramName(currentProgram.name);
      setCpuState(null);
      setPrevCpuState(null);
      setStepIndex(0);
    } else {
      const def = SAMPLE_PROGRAMS.array_sum;
      setSourceCode(def.code);
      setPreset(def.preset);
      setProgramName(def.name);
    }
  }, [currentProgram]);

  const handleSaveProgram = async () => {
    if (!currentProgram) return;
    try {
      const updated = await api.updateProgram(currentProgram.id, {
        name: programName,
        assembly_source: sourceCode,
        isa_preset: preset,
      });
      onProgramUpdate(updated);
      showToast('Program saved successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save program', 'error');
    }
  };

  const handleLoadSample = (key: string) => {
    const sample = SAMPLE_PROGRAMS[key];
    if (sample) {
      setSourceCode(sample.code);
      setPreset(sample.preset);
      setProgramName(sample.name);
      setCpuState(null);
      setPrevCpuState(null);
      setStepIndex(0);
      showToast(`Loaded sample "${sample.name}"`, 'info');
    }
  };

  const handleStep = async () => {
    if (!currentProgram) {
      showToast('Save program before stepping', 'warning');
      return;
    }
    try {
      const res = await api.stepProgram(currentProgram.id, {
        assembly_source: sourceCode,
        step_index: stepIndex,
      });
      setPrevCpuState(cpuState);
      setCpuState(res.cpu_state);
      setStepIndex(res.step_index);
    } catch (err: any) {
      showToast(err.message || 'Step execution failed', 'error');
    }
  };

  const handleRun = async () => {
    if (!currentProgram) {
      showToast('Save program before running', 'warning');
      return;
    }
    setIsRunning(true);
    try {
      const res = await api.runProgram(currentProgram.id, {
        assembly_source: sourceCode,
        max_cycles: 250,
      });
      setPrevCpuState(cpuState);
      setCpuState(res.final_cpu_state);
      setStepIndex(res.cycles);
      showToast(`Execution finished in ${res.cycles} cycles (CPI: ${res.cpi})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Execution error', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setPrevCpuState(null);
    setCpuState(null);
    setStepIndex(0);
    showToast('CPU State reset to cycle 0', 'info');
  };

  // Convert int to Hex
  const toHex = (val: number | undefined) => {
    if (val === undefined) return '0x0000';
    const unsigned = (val < 0) ? (val + 0x10000) & 0xffff : val & 0xffff;
    return '0x' + unsigned.toString(16).toUpperCase().padStart(4, '0');
  };

  // Convert int to 8-bit Binary
  const toBin = (val: number | undefined) => {
    if (val === undefined) return '00000000';
    const unsigned = (val < 0) ? (val + 256) & 0xff : val & 0xff;
    return unsigned.toString(2).padStart(8, '0');
  };

  const bus = cpuState?.bus_activity || {
    alu_op: null,
    alu_in1: null,
    alu_in2: null,
    alu_out: null,
    mem_read: false,
    mem_write: false,
    reg_write: false,
    branch_taken: false,
  };

  const lines = sourceCode.split('\n');
  const lineCount = Math.max(1, lines.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="text"
            className="form-input"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            style={{ fontWeight: 600, width: '240px' }}
            placeholder="Program Name"
          />
          <select
            className="form-select"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            style={{ width: '130px' }}
          >
            <option value="RISC-V">RISC-V ISA</option>
            <option value="MIPS">MIPS ISA</option>
            <option value="x86">x86 ISA</option>
          </select>
          {currentProgram && (
            <button onClick={handleSaveProgram} className="btn btn-secondary btn-sm" title="Save changes">
              💾 Save
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <select
            className="form-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleLoadSample(e.target.value);
            }}
            style={{ width: '200px' }}
          >
            <option value="" disabled>Load Sample Program...</option>
            <option value="array_sum">Array Sum with Branch</option>
            <option value="factorial">Factorial (4! = 24)</option>
            <option value="memory_copy">Memory Block Copy</option>
            <option value="x86_counter">x86 Arithmetic Loop</option>
          </select>

          <button onClick={handleStep} className="btn btn-secondary btn-sm" title="Execute single instruction">
            ⏭️ Step
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="btn btn-primary btn-sm"
            title="Run to completion"
          >
            {isRunning ? 'Running...' : '▶ Run'}
          </button>
          <button onClick={handleReset} className="btn btn-secondary btn-sm" title="Reset PC & Registers">
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Main 70/30 Layout with distinct --bg-surface, --border, border-radius: 12px */}
      <div className="layout-70-30">
        {/* Left Column (70%): Real Code Editor + SVG Datapath + Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Assembly Code Editor Shell */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📝</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Assembly Source Editor
                </h3>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                PC: <strong style={{ color: 'var(--accent-cyan)' }}>{cpuState ? cpuState.pc : 0}</strong>{' '}
                | Cycles: <strong style={{ color: 'var(--accent)' }}>{cpuState ? cpuState.cycles : 0}</strong>
              </div>
            </div>

            {/* Real Code Editor with Line Numbers Gutter */}
            <div className="code-editor-shell">
              <div className="code-editor-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {programName ? programName.toLowerCase().replace(/\s+/g, '_') : 'main'}.s
                  </span>
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                    {preset}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                  <span>{lineCount} lines</span>
                  <span>UTF-8</span>
                </div>
              </div>

              <div className="code-editor-body">
                {/* Gutter with line numbers */}
                <div ref={gutterRef} className="code-editor-gutter">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i + 1}>{i + 1}</div>
                  ))}
                </div>

                {/* Editor Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={13}
                  className="code-editor-textarea"
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  onScroll={handleEditorScroll}
                  placeholder="; Enter assembly instructions here..."
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          {/* Interactive SVG Datapath with New Accent Colors & Glowing Nodes */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Interactive CPU Datapath
                </h3>
              </div>
              <span className={`badge ${bus.alu_op ? 'badge-blue' : 'badge-amber'}`}>
                {bus.alu_op ? `ALU: ${bus.alu_op}` : bus.mem_read ? 'MEM READ' : bus.mem_write ? 'MEM WRITE' : 'IDLE'}
              </span>
            </div>

            <div
              style={{
                width: '100%',
                overflowX: 'auto',
                background: '#09090b',
                borderRadius: '10px',
                padding: '0.75rem',
                border: '1px solid var(--border)',
              }}
            >
              <svg viewBox="0 0 760 220" style={{ width: '100%', minWidth: '700px', height: 'auto' }}>
                <defs>
                  {/* Subtle Node Glow Filter */}
                  <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.5" />
                  </filter>
                  <filter id="aluGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.5" />
                  </filter>
                  <filter id="memGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.5" />
                  </filter>
                  <filter id="regGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.5" />
                  </filter>

                  {/* Colored Arrow Markers */}
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#6366f1" />
                  </marker>
                  <marker id="arrowGreen" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                  </marker>
                  <marker id="arrowCyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                  </marker>
                  <marker id="arrowAmber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                  </marker>
                </defs>

                {/* Bus Wires (Background) with SaaS Accent Colors */}
                <path d="M 80 110 L 120 110" stroke={cpuState ? '#6366f1' : '#27272a'} strokeWidth="3" markerEnd="url(#arrow)" />
                <path d="M 220 110 L 260 110" stroke={cpuState ? '#6366f1' : '#27272a'} strokeWidth="3" markerEnd="url(#arrow)" />
                <path d="M 360 85 L 430 85" stroke={bus.alu_in1 !== null ? '#10b981' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_in1 !== null ? 'url(#arrowGreen)' : 'url(#arrow)'} />
                <path d="M 360 135 L 430 135" stroke={bus.alu_in2 !== null ? '#10b981' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_in2 !== null ? 'url(#arrowGreen)' : 'url(#arrow)'} />
                <path d="M 510 110 L 570 110" stroke={bus.alu_out !== null ? '#06b6d4' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_out !== null ? 'url(#arrowCyan)' : 'url(#arrow)'} />
                <path d="M 670 110 L 710 110" stroke={bus.mem_read ? '#06b6d4' : '#27272a'} strokeWidth="3" />
                <path d="M 710 110 L 710 200 L 310 200 L 310 160" stroke={bus.reg_write ? '#f59e0b' : '#27272a'} strokeWidth="3" strokeDasharray="5,5" markerEnd="url(#arrowAmber)" />

                {/* 1. PC Block */}
                <rect
                  x="20"
                  y="80"
                  width="60"
                  height="60"
                  rx="8"
                  fill="#18181b"
                  stroke={cpuState ? '#6366f1' : '#27272a'}
                  strokeWidth="2"
                  filter={cpuState ? 'url(#nodeGlow)' : undefined}
                />
                <text x="50" y="105" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">PC</text>
                <text x="50" y="125" fill="#a5b4fc" fontSize="14" fontWeight="bold" textAnchor="middle">{cpuState ? cpuState.pc : 0}</text>

                {/* 2. Instruction Memory Block */}
                <rect x="120" y="70" width="100" height="80" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="2" />
                <text x="170" y="105" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">Instruction</text>
                <text x="170" y="125" fill="#a1a1aa" fontSize="11" textAnchor="middle">Memory</text>

                {/* 3. Register File Block */}
                <rect
                  x="260"
                  y="60"
                  width="100"
                  height="100"
                  rx="8"
                  fill="#18181b"
                  stroke={bus.reg_write ? '#f59e0b' : '#27272a'}
                  strokeWidth="2"
                  filter={bus.reg_write ? 'url(#regGlow)' : undefined}
                />
                <text x="310" y="95" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">Register File</text>
                <text x="310" y="115" fill="#a1a1aa" fontSize="10" textAnchor="middle">R0 .. R7</text>
                <text x="310" y="135" fill={bus.reg_write ? '#f59e0b' : '#71717a'} fontSize="9" textAnchor="middle">
                  {bus.reg_write ? 'WRITE ACTIVE' : '3-Port File'}
                </text>

                {/* 4. ALU Polygon Block */}
                <polygon
                  points="430,60 480,95 480,125 430,160 430,120 440,110 430,100"
                  fill="#18181b"
                  stroke={bus.alu_op ? '#10b981' : '#27272a'}
                  strokeWidth="2"
                  filter={bus.alu_op ? 'url(#aluGlow)' : undefined}
                />
                <text x="455" y="115" fill={bus.alu_op ? '#34d399' : '#a1a1aa'} fontSize="11" fontWeight="bold" textAnchor="middle">ALU</text>

                {/* 5. Data Memory Block */}
                <rect
                  x="570"
                  y="65"
                  width="100"
                  height="90"
                  rx="8"
                  fill="#18181b"
                  stroke={bus.mem_read || bus.mem_write ? '#06b6d4' : '#27272a'}
                  strokeWidth="2"
                  filter={bus.mem_read || bus.mem_write ? 'url(#memGlow)' : undefined}
                />
                <text x="620" y="100" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">Data Memory</text>
                <text x="620" y="120" fill={bus.mem_write ? '#f43f5e' : bus.mem_read ? '#06b6d4' : '#71717a'} fontSize="10" textAnchor="middle">
                  {bus.mem_write ? 'MEM WRITE' : bus.mem_read ? 'MEM READ' : 'RAM'}
                </text>

                {/* Writeback line label */}
                <text x="510" y="215" fill="#f59e0b" fontSize="10" textAnchor="middle">Writeback Loop (Result → Reg File)</text>
              </svg>
            </div>
          </div>

          {/* Console / Log Output */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              CPU Execution Trace Log
            </h3>
            <div
              style={{
                height: '140px',
                overflowY: 'auto',
                background: '#09090b',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              {cpuState && cpuState.log.length > 0 ? (
                cpuState.log.map((line, idx) => (
                  <div key={idx} style={{ color: line.includes('HALT') ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                    {line}
                  </div>
                ))
              ) : (
                <span style={{ color: 'var(--text-dim)' }}>Simulation ready. Click "Step" or "Run" to begin trace.</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (30%): Live Registers & Memory Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Register File Table with Zebra-Striping & Changed Value Highlights */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Register File (R0-R7)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Live CPU Core</span>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reg</th>
                    <th>Hex</th>
                    <th>Dec</th>
                    <th>Binary</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                    const regName = `R${i}`;
                    const val = cpuState?.registers[regName] ?? 0;
                    const prevVal = prevCpuState?.registers[regName];
                    const isChanged = prevVal !== undefined && prevVal !== val;

                    return (
                      <tr key={regName}>
                        <td style={{ fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          {regName}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          <span className={isChanged ? 'val-highlight' : undefined}>
                            {toHex(val)}
                          </span>
                        </td>
                        <td>
                          <span className={isChanged ? 'val-highlight' : undefined}>
                            {val}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {toBin(val)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Flags */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '1rem',
                padding: '0.65rem 0.85rem',
                background: '#121215',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.825rem',
              }}
            >
              <div>
                Zero Flag (Z):{' '}
                <strong style={{ color: cpuState?.flags.Z ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                  {cpuState?.flags.Z ? '1' : '0'}
                </strong>
              </div>
              <div>
                Negative Flag (N):{' '}
                <strong style={{ color: cpuState?.flags.N ? 'var(--accent-rose)' : 'var(--text-dim)' }}>
                  {cpuState?.flags.N ? '1' : '0'}
                </strong>
              </div>
            </div>
          </div>

          {/* Memory Inspector with Filter, Zebra-Striping & Changed Value Highlights */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Memory Inspector
              </h3>
              <input
                type="text"
                className="form-input"
                placeholder="Filter addr..."
                value={memoryFilter}
                onChange={(e) => setMemoryFilter(e.target.value)}
                style={{ width: '110px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              />
            </div>

            <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Hex</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {cpuState && Object.keys(cpuState.memory).length > 0 ? (
                    Object.entries(cpuState.memory)
                      .filter(([addr]) => (memoryFilter ? addr.includes(memoryFilter) : true))
                      .map(([addr, val]) => {
                        const prevMemVal = prevCpuState?.memory[addr];
                        const isChanged = prevMemVal !== undefined && prevMemVal !== val;
                        return (
                          <tr key={addr}>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>[{addr}]</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              <span className={isChanged ? 'val-highlight' : undefined}>{toHex(val)}</span>
                            </td>
                            <td>
                              <span className={isChanged ? 'val-highlight' : undefined}>{val}</span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '1.5rem' }}>
                        Memory uninitialized or all zeros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
