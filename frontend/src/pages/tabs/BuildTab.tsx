import React, { useState, useEffect, useRef } from 'react';
import { Program, CPUState } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface BuildTabProps {
  currentProgram: Program | null;
  sourceCode: string;
  setSourceCode: (code: string) => void;
  preset: string;
  setPreset: (preset: string) => void;
  programName: string;
  setProgramName: (name: string) => void;
  isDirty: boolean;
  onSaveProgram: () => Promise<void>;
  onSaveAsNewProgram: () => Promise<void>;
  onOpenISAGuide: () => void;
  onJumpToOptimize: () => void;
}

export const SAMPLE_PROGRAMS: Record<string, { name: string; preset: string; desc: string; code: string }> = {
  array_sum: {
    name: 'Array Sum with Branch',
    preset: 'RISC-V',
    desc: 'Sums 3 + 2 + 1 in a loop using BRNZ and stores result at [100]',
    code: `; Array Sum with Branch
; Calculates sum of numbers 3, 2, 1 using a counter loop
LOAD R1, 3        ; R1 = counter (number of iterations)
LOAD R2, 0        ; R2 = accumulator (sum)
LOAD R3, 1        ; R3 = decrement step
LOOP:
ADD R2, R2, R1    ; sum = sum + counter
SUB R1, R1, R3    ; counter = counter - 1
BRNZ R1, LOOP     ; branch to LOOP if counter != 0
STORE R2, [100]   ; write final sum (6) to memory address 100
HALT              ; terminate execution
`,
  },
  factorial: {
    name: 'Factorial of 4 (4! = 24)',
    preset: 'RISC-V',
    desc: 'Computes 4! = 24 iteratively using MUL and stores at [150]',
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
  load_use_hazard: {
    name: 'Load-Use Hazard Demo',
    preset: 'MIPS',
    desc: 'Demonstrates RAW memory load-use stall & ALU forwarding',
    code: `; Load-Use Data Hazard Demo
LOAD R1, 25       ; Initialize value 25
STORE R1, [50]    ; Store 25 at memory [50]
LOAD R1, [50]     ; Memory load into R1
ADD R2, R1, R1    ; Dependent instruction immediately uses R1 (Load-Use Stall!)
SUB R4, R2, R1    ; Resolved via EX->EX Forwarding
STORE R4, [60]    ; Store result at [60]
HALT
`,
  },
  x86_counter: {
    name: 'x86 Compare & Branch',
    preset: 'x86',
    desc: 'Uses x86 registers, inc, shl, cmp, je, and memory store',
    code: `; x86 Arithmetic & Conditional Jump
mov eax, 10
mov ebx, 2
add eax, ebx      ; eax = 12
shl eax, 1        ; eax = 24
mov [200], eax    ; store 24 at [200]
cmp eax, 24
je DONE
mov ecx, 99
DONE:
mov ecx, 1        ; ecx = 1 indicates success
hlt
`,
  },
};

export const BuildTab: React.FC<BuildTabProps> = ({
  currentProgram,
  sourceCode,
  setSourceCode,
  preset,
  setPreset,
  programName,
  setProgramName,
  isDirty,
  onSaveProgram,
  onSaveAsNewProgram,
  onOpenISAGuide,
  onJumpToOptimize,
}) => {
  const { showToast } = useToast();

  // Simulation Trace State (supports stepping forward, backward, and auto-play)
  const [cpuTrace, setCpuTrace] = useState<CPUState[]>([]);
  const [traceIdx, setTraceIdx] = useState<number>(-1); // -1 means reset / before cycle 1
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [playSpeedMs, setPlaySpeedMs] = useState<number>(600);
  const [memoryFilter, setMemoryFilter] = useState<string>('');
  const [controlUnitMode, setControlUnitMode] = useState<'hardwired' | 'microprogrammed'>('hardwired');
  const [lastError, setLastError] = useState<string | null>(null);

  const cpuState = traceIdx >= 0 && traceIdx < cpuTrace.length ? cpuTrace[traceIdx] : null;
  const prevCpuState = traceIdx > 0 && traceIdx - 1 < cpuTrace.length ? cpuTrace[traceIdx - 1] : null;

  // Editor Line Numbers Sync
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const handleEditorScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Reset trace when switching programs
  useEffect(() => {
    setCpuTrace([]);
    setTraceIdx(-1);
    setIsAutoPlaying(false);
    setLastError(null);
  }, [currentProgram?.id]);

  // Auto-play timer
  useEffect(() => {
    if (!isAutoPlaying) return;
    if (traceIdx >= cpuTrace.length - 1 && cpuTrace.length > 0) {
      setIsAutoPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setTraceIdx((prev) => {
        if (prev + 1 >= cpuTrace.length) {
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeedMs);
    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, traceIdx, cpuTrace, playSpeedMs]);

  // Keyboard shortcuts (Cmd/Ctrl+S to save, Cmd/Ctrl+Enter to run)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentProgram) {
          onSaveProgram();
        } else {
          onSaveAsNewProgram();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Fetch full trace if not yet fetched or if source changed
  const ensureTraceLoaded = async (recordRun: boolean = false): Promise<CPUState[] | null> => {
    setLastError(null);
    try {
      const res = await api.runProgram(currentProgram?.id ?? null, {
        assembly_source: sourceCode,
        isa_preset: preset,
        max_cycles: 250,
        record_run: recordRun,
      });
      setCpuTrace(res.cpu_trace || []);
      return res.cpu_trace || [];
    } catch (err: any) {
      const msg = err.message || 'Assembly / Execution failed';
      setLastError(msg);
      showToast(msg, 'error');
      setIsAutoPlaying(false);
      return null;
    }
  };

  const handleStepForward = async () => {
    setIsAutoPlaying(false);
    let trace = cpuTrace;
    if (trace.length === 0) {
      const loaded = await ensureTraceLoaded(false);
      if (!loaded || loaded.length === 0) return;
      trace = loaded;
      setTraceIdx(0);
      return;
    }
    if (traceIdx < trace.length - 1) {
      setTraceIdx(traceIdx + 1);
    } else {
      showToast('Program has already reached HALT.', 'info');
    }
  };

  const handleStepBack = () => {
    setIsAutoPlaying(false);
    if (traceIdx > 0) {
      setTraceIdx(traceIdx - 1);
    } else if (traceIdx === 0) {
      setTraceIdx(-1);
    }
  };

  const handleToggleAutoPlay = async () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      return;
    }
    let trace = cpuTrace;
    if (trace.length === 0) {
      const loaded = await ensureTraceLoaded(false);
      if (!loaded || loaded.length === 0) return;
      trace = loaded;
    }
    if (traceIdx >= trace.length - 1) {
      setTraceIdx(0);
    } else if (traceIdx < 0) {
      setTraceIdx(0);
    }
    setIsAutoPlaying(true);
  };

  const handleRun = async () => {
    setIsAutoPlaying(false);
    setIsRunning(true);
    setLastError(null);
    try {
      const res = await api.runProgram(currentProgram?.id ?? null, {
        assembly_source: sourceCode,
        isa_preset: preset,
        max_cycles: 250,
        record_run: true,
      });
      const trace = res.cpu_trace || [];
      setCpuTrace(trace);
      setTraceIdx(trace.length - 1);
      showToast(
        `Executed ${res.instruction_count} instructions in ${res.cycles} cycles (Pipelined CPI: ${res.cpi})`,
        'success'
      );
    } catch (err: any) {
      const msg = err.message || 'Execution error';
      setLastError(msg);
      showToast(msg, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setIsAutoPlaying(false);
    setTraceIdx(-1);
    setLastError(null);
  };

  const handleSourceEdit = (newCode: string) => {
    setSourceCode(newCode);
    // Invalidate trace when code is edited so next Step/Run re-assembles
    if (cpuTrace.length > 0) {
      setCpuTrace([]);
      setTraceIdx(-1);
      setIsAutoPlaying(false);
    }
    if (lastError) setLastError(null);
  };

  // Convert int to Hex
  const toHex = (val: number | undefined) => {
    if (val === undefined) return '0x0000';
    const unsigned = val < 0 ? (val + 0x10000) & 0xffff : val & 0xffff;
    return '0x' + unsigned.toString(16).toUpperCase().padStart(4, '0');
  };

  // Convert int to 8-bit Binary
  const toBin = (val: number | undefined) => {
    if (val === undefined) return '00000000';
    const unsigned = val < 0 ? (val + 256) & 0xff : val & 0xff;
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

  const activeLineNo = cpuState?.current_instruction?.line_no ?? null;
  const activeInstruction = cpuState?.current_instruction ?? null;

  // Derive Control Unit signals for educational Hardwired vs Microprogrammed toggle
  const controlSignals = {
    RegWrite: bus.reg_write ? 1 : 0,
    ALUSrc: activeInstruction?.imm !== null && activeInstruction?.imm !== undefined ? 1 : 0,
    MemRead: bus.mem_read ? 1 : 0,
    MemWrite: bus.mem_write ? 1 : 0,
    MemToReg: bus.mem_read ? 1 : 0,
    Branch: bus.branch_taken ? 1 : 0,
    ALUOp: bus.alu_op || 'NOP',
  };
  const microcodeWordBin = `${controlSignals.RegWrite}${controlSignals.ALUSrc}${controlSignals.MemRead}${controlSignals.MemWrite}${controlSignals.MemToReg}${controlSignals.Branch}${bus.alu_op ? '10' : '00'}`;
  const microcodeWordHex = '0x' + parseInt(microcodeWordBin, 2).toString(16).toUpperCase().padStart(2, '0');

  const lines = sourceCode.split('\n');
  const lineCount = Math.max(1, lines.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Execution & File Control Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          borderRadius: '12px',
        }}
      >
        {/* Left: Program Title, ISA Selector, Save Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              style={{ fontWeight: 600, width: '210px', paddingRight: isDirty ? '2rem' : '0.75rem' }}
              placeholder="Program Name"
              aria-label="Program Name"
            />
            {isDirty && (
              <span
                title="Unsaved changes"
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-amber)',
                  boxShadow: '0 0 8px var(--accent-amber)',
                }}
              />
            )}
          </div>

          <select
            className="form-select"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              setCpuTrace([]);
              setTraceIdx(-1);
            }}
            style={{ width: '125px', fontWeight: 600 }}
            aria-label="Instruction Set Architecture"
          >
            <option value="RISC-V">RISC-V ISA</option>
            <option value="MIPS">MIPS ISA</option>
            <option value="x86">x86 ISA</option>
          </select>

          {currentProgram ? (
            <button
              onClick={onSaveProgram}
              className={`btn ${isDirty ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              title="Save changes (Ctrl/Cmd + S)"
            >
              💾 {isDirty ? 'Save*' : 'Saved'}
            </button>
          ) : (
            <button
              onClick={onSaveAsNewProgram}
              className="btn btn-primary btn-sm"
              title="Save to workspace"
            >
              💾 Save to Workspace
            </button>
          )}

          <button
            onClick={onOpenISAGuide}
            className="btn btn-secondary btn-sm"
            title="Open ISA Reference & Instruction Cheatsheet"
          >
            📖 {preset} Reference
          </button>
        </div>

        {/* Right: Interactive Debugger & Playback Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleStepBack}
            disabled={traceIdx < 0}
            className="btn btn-secondary btn-sm"
            title="Step Back 1 Cycle"
          >
            ⏮ Back
          </button>

          <button
            onClick={handleStepForward}
            className="btn btn-secondary btn-sm"
            title="Step Forward 1 Cycle"
          >
            ⏭ Step
          </button>

          <button
            onClick={handleToggleAutoPlay}
            className={`btn ${isAutoPlaying ? 'btn-danger' : 'btn-secondary'} btn-sm`}
            title="Animate cycle-by-cycle execution"
          >
            {isAutoPlaying ? '⏸ Pause' : '⏯ Auto-Step'}
          </button>

          <select
            className="form-select"
            value={playSpeedMs}
            onChange={(e) => setPlaySpeedMs(Number(e.target.value))}
            style={{ width: '78px', padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
            title="Auto-Step Speed"
          >
            <option value={1000}>0.5x</option>
            <option value={600}>1.0x</option>
            <option value={300}>2.0x</option>
            <option value={120}>4.0x</option>
          </select>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="btn btn-primary btn-sm"
            title="Run to completion (Ctrl/Cmd + Enter)"
          >
            {isRunning ? 'Running...' : '▶ Run All'}
          </button>

          <button
            onClick={handleReset}
            disabled={traceIdx < 0 && cpuTrace.length === 0}
            className="btn btn-secondary btn-sm"
            title="Reset CPU to Cycle 0"
          >
            ↺ Reset
          </button>

          <button
            onClick={onJumpToOptimize}
            className="btn btn-accent btn-sm"
            title="Inspect 5-Stage Pipeline & Hazards for this code"
          >
            🚀 Pipeline View →
          </button>
        </div>
      </div>

      {/* Inline Assembly Error Banner (if syntax error occurred) */}
      {lastError && (
        <div
          className="fade-in"
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.14)',
            border: '1px solid var(--accent-rose)',
            color: '#fda4af',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-mono)' }}>
            <span>⚠️</span>
            <strong>Assembly Error:</strong>
            <span>{lastError}</span>
          </div>
          <button onClick={onOpenISAGuide} className="btn btn-secondary btn-sm">
            View {preset} Syntax Guide
          </button>
        </div>
      )}

      {/* Cycle Scrubber Bar when trace is active */}
      {cpuTrace.length > 0 && (
        <div
          className="glass-panel fade-in"
          style={{
            padding: '0.65rem 1.15rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a5b4fc', whiteSpace: 'nowrap' }}>
            Timeline Scrubber:
          </span>
          <input
            type="range"
            min={0}
            max={cpuTrace.length - 1}
            value={Math.max(0, traceIdx)}
            onChange={(e) => {
              setIsAutoPlaying(false);
              setTraceIdx(Number(e.target.value));
            }}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Cycle <strong>{traceIdx + 1}</strong> / {cpuTrace.length}{' '}
            {activeInstruction && (
              <span className="badge badge-blue" style={{ marginLeft: '0.4rem' }}>
                Line {activeInstruction.line_no}: {activeInstruction.opcode}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Main 70/30 Layout */}
      <div className="layout-70-30">
        {/* Left Column (70%): Code Editor + SVG Datapath + Control Unit + Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Assembly Code Editor Shell */}
          <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📝</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Assembly Source Editor
                </h3>
                {activeLineNo && (
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                    ▶ Executing Line {activeLineNo}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                PC Index: <strong style={{ color: 'var(--accent-cyan)' }}>{cpuState ? cpuState.pc : 0}</strong>{' '}
                | Next PC: <strong style={{ color: '#a5b4fc' }}>{cpuState ? cpuState.next_pc : 0}</strong>{' '}
                | Cycles: <strong style={{ color: 'var(--accent)' }}>{cpuState ? cpuState.cycles : 0}</strong>{' '}
                | Status:{' '}
                <strong
                  style={{
                    color:
                      cpuState?.status === 'HALTED'
                        ? 'var(--accent-emerald)'
                        : cpuState?.status === 'RUNNING'
                        ? 'var(--accent-amber)'
                        : 'var(--text-muted)',
                  }}
                >
                  {cpuState ? cpuState.status : 'READY'}
                </strong>
              </div>
            </div>

            {/* Code Editor with Active Execution Line Indicator */}
            <div className="code-editor-shell">
              <div className="code-editor-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {programName ? programName.toLowerCase().replace(/\s+/g, '_') : 'main'}.s
                  </span>
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                    {preset}
                  </span>
                  {isDirty && (
                    <span className="badge badge-amber" style={{ fontSize: '0.62rem' }}>
                      Modified
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.72rem' }}>
                  <span>Ctrl+Enter: Run</span>
                  <span>Ctrl+S: Save</span>
                  <span>{lineCount} lines</span>
                </div>
              </div>

              <div className="code-editor-body">
                {/* Gutter with line numbers & active PC pointer */}
                <div ref={gutterRef} className="code-editor-gutter" style={{ overflow: 'hidden' }}>
                  {Array.from({ length: lineCount }, (_, i) => {
                    const ln = i + 1;
                    const isCurrentLine = activeLineNo === ln;
                    return (
                      <div
                        key={ln}
                        style={{
                          backgroundColor: isCurrentLine ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                          color: isCurrentLine ? '#34d399' : '#52525b',
                          fontWeight: isCurrentLine ? 800 : 400,
                          paddingRight: '0.35rem',
                          borderRadius: '3px',
                        }}
                      >
                        {isCurrentLine ? `▶ ${ln}` : ln}
                      </div>
                    );
                  })}
                </div>

                {/* Editor Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={12}
                  className="code-editor-textarea"
                  value={sourceCode}
                  onChange={(e) => handleSourceEdit(e.target.value)}
                  onScroll={handleEditorScroll}
                  placeholder="; Enter assembly instructions here..."
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          {/* Interactive SVG Datapath with Hardwired vs Microprogrammed Control Unit */}
          <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.85rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚡</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Interactive CPU Datapath & Control Unit
                </h3>
                <span className={`badge ${bus.alu_op ? 'badge-green' : bus.mem_read || bus.mem_write ? 'badge-cyan' : 'badge-blue'}`}>
                  {bus.alu_op
                    ? `ALU: ${bus.alu_op} (${bus.alu_in1} , ${bus.alu_in2}) → ${bus.alu_out}`
                    : bus.mem_read
                    ? 'MEM READ'
                    : bus.mem_write
                    ? 'MEM WRITE'
                    : activeInstruction
                    ? activeInstruction.opcode
                    : 'IDLE'}
                </span>
              </div>

              {/* Hardwired vs Microprogrammed Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Control Unit:</span>
                <button
                  type="button"
                  onClick={() => setControlUnitMode('hardwired')}
                  className={`btn ${controlUnitMode === 'hardwired' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                >
                  Hardwired Gates
                </button>
                <button
                  type="button"
                  onClick={() => setControlUnitMode('microprogrammed')}
                  className={`btn ${controlUnitMode === 'microprogrammed' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                >
                  Microprogrammed ROM
                </button>
              </div>
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
              <svg viewBox="0 0 760 220" style={{ width: '100%', minWidth: '680px', height: 'auto' }}>
                <defs>
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

                {/* Bus Wires */}
                <path d="M 80 110 L 120 110" stroke={cpuState ? '#6366f1' : '#27272a'} strokeWidth="3" markerEnd="url(#arrow)" />
                <path d="M 220 110 L 260 110" stroke={cpuState ? '#6366f1' : '#27272a'} strokeWidth="3" markerEnd="url(#arrow)" />
                <path d="M 360 85 L 430 85" stroke={bus.alu_in1 !== null ? '#10b981' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_in1 !== null ? 'url(#arrowGreen)' : 'url(#arrow)'} />
                <path d="M 360 135 L 430 135" stroke={bus.alu_in2 !== null ? '#10b981' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_in2 !== null ? 'url(#arrowGreen)' : 'url(#arrow)'} />
                <path d="M 485 110 L 570 110" stroke={bus.alu_out !== null ? '#06b6d4' : '#27272a'} strokeWidth="3" markerEnd={bus.alu_out !== null ? 'url(#arrowCyan)' : 'url(#arrow)'} />
                <path d="M 670 110 L 710 110" stroke={bus.mem_read || bus.reg_write ? '#06b6d4' : '#27272a'} strokeWidth="3" />
                <path d="M 710 110 L 710 200 L 310 200 L 310 160" stroke={bus.reg_write ? '#f59e0b' : '#27272a'} strokeWidth="3" strokeDasharray="5,5" markerEnd="url(#arrowAmber)" />

                {/* Wire Value Labels */}
                {bus.alu_in1 !== null && (
                  <text x="395" y="77" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">
                    {bus.alu_in1}
                  </text>
                )}
                {bus.alu_in2 !== null && (
                  <text x="395" y="150" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">
                    {bus.alu_in2}
                  </text>
                )}
                {bus.alu_out !== null && (
                  <text x="528" y="102" fill="#67e8f9" fontSize="10" fontWeight="bold" textAnchor="middle">
                    ={bus.alu_out}
                  </text>
                )}

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
                <text x="50" y="103" fill="#f4f4f5" fontSize="11" fontWeight="bold" textAnchor="middle">PC</text>
                <text x="50" y="124" fill="#a5b4fc" fontSize="14" fontWeight="bold" textAnchor="middle">{cpuState ? cpuState.pc : 0}</text>

                {/* 2. Instruction Memory Block */}
                <rect x="120" y="65" width="100" height="90" rx="8" fill="#18181b" stroke={activeInstruction ? '#6366f1' : '#27272a'} strokeWidth="2" />
                <text x="170" y="95" fill="#f4f4f5" fontSize="11" fontWeight="bold" textAnchor="middle">Instruction</text>
                <text x="170" y="112" fill="#a1a1aa" fontSize="10" textAnchor="middle">Memory</text>
                <text x="170" y="135" fill="#a5b4fc" fontSize="11" fontWeight="bold" textAnchor="middle">
                  {activeInstruction ? activeInstruction.opcode : 'FETCH'}
                </text>

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
                <text x="310" y="92" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">Register File</text>
                <text x="310" y="112" fill="#a1a1aa" fontSize="10" textAnchor="middle">
                  {activeInstruction?.rd ? `Target: ${activeInstruction.rd}` : 'R0 .. R7'}
                </text>
                <text x="310" y="135" fill={bus.reg_write ? '#f59e0b' : '#71717a'} fontSize="9" fontWeight="bold" textAnchor="middle">
                  {bus.reg_write ? 'WRITE ENABLED' : '3-Port Read/Write'}
                </text>

                {/* 4. ALU Polygon Block */}
                <polygon
                  points="430,60 485,92 485,128 430,160 430,120 442,110 430,100"
                  fill="#18181b"
                  stroke={bus.alu_op ? '#10b981' : '#27272a'}
                  strokeWidth="2"
                  filter={bus.alu_op ? 'url(#aluGlow)' : undefined}
                />
                <text x="460" y="114" fill={bus.alu_op ? '#34d399' : '#a1a1aa'} fontSize="11" fontWeight="bold" textAnchor="middle">
                  {bus.alu_op || 'ALU'}
                </text>

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
                <text x="620" y="122" fill={bus.mem_write ? '#f43f5e' : bus.mem_read ? '#06b6d4' : '#71717a'} fontSize="10" fontWeight="bold" textAnchor="middle">
                  {bus.mem_write ? 'MEM WRITE' : bus.mem_read ? 'MEM READ' : 'RAM [0..255]'}
                </text>

                <text x="510" y="214" fill={bus.reg_write ? '#f59e0b' : '#52525b'} fontSize="10" textAnchor="middle">
                  Writeback Bus (Result → Register File)
                </text>
              </svg>
            </div>

            {/* Control Unit Signal Strip */}
            <div
              style={{
                marginTop: '0.85rem',
                padding: '0.75rem 1rem',
                background: '#121215',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                fontSize: '0.78rem',
              }}
            >
              {controlUnitMode === 'hardwired' ? (
                <>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    Hardwired Control Signals:
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontFamily: 'var(--font-mono)' }}>
                    {Object.entries(controlSignals).map(([sig, val]) => {
                      const isActive = val === 1 || (sig === 'ALUOp' && val !== 'NOP');
                      return (
                        <span
                          key={sig}
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
                            border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                            color: isActive ? '#a5b4fc' : 'var(--text-dim)',
                            fontWeight: isActive ? 700 : 400,
                          }}
                        >
                          {sig}={val}
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    Microprogram ROM Word (µPC={cpuState ? cpuState.pc : 0}):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
                    <span className="badge badge-amber">Hex: {microcodeWordHex}</span>
                    <span className="badge badge-blue">Bits: {microcodeWordBin}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      [RW|ALUSrc|MR|MW|M2R|Br|ALUOp]
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Console / Execution Trace Log (Click any line to jump to that cycle!) */}
          <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                CPU Execution Trace Log
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {cpuTrace.length > 0 ? 'Click any cycle entry to inspect state at that step' : 'Ready to execute'}
              </span>
            </div>
            <div
              style={{
                height: '145px',
                overflowY: 'auto',
                background: '#09090b',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}
            >
              {cpuTrace.length > 0 ? (
                cpuTrace.map((st, idx) => {
                  const lastLog = st.log[st.log.length - 1] || `Cycle ${st.cycles}`;
                  const isSelected = idx === traceIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setTraceIdx(idx);
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: lastLog.includes('HALT')
                          ? 'var(--accent-emerald)'
                          : isSelected
                          ? '#ffffff'
                          : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      {isSelected ? '▶ ' : '  '}
                      {lastLog}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: 'var(--text-dim)' }}>
                  Click "⏭ Step", "⏯ Auto-Step", or "▶ Run All" above to execute your assembly program.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (30%): Live Registers & Memory Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Register File Table */}
          <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Register File (R0–R7)
              </h3>
              <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>
                {preset} Aliases
              </span>
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
                    const aliasMap: Record<string, string[]> = {
                      'RISC-V': ['x0/zero', 'x1/ra', 'x2/sp', 'x3/gp', 'x4/tp', 'x5/t0', 'x6/t1', 'x7/t2'],
                      MIPS: ['$zero', '$t0', '$t1', '$t2', '$t3', '$s0', '$s1', '$ra'],
                      x86: ['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp'],
                    };
                    const alias = aliasMap[preset]?.[i] || '';
                    const val = cpuState?.registers[regName] ?? 0;
                    const prevVal = prevCpuState?.registers[regName] ?? 0;
                    const isChanged = cpuState !== null && val !== prevVal;

                    return (
                      <tr key={regName}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          <strong style={{ color: 'var(--accent)' }}>{regName}</strong>
                          {alias && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: '0.35rem' }}>
                              ({alias})
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          <span className={isChanged ? 'val-highlight' : undefined}>{toHex(val)}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          <span className={isChanged ? 'val-highlight' : undefined}>{val}</span>
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

            {/* Condition Flags */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.85rem',
                padding: '0.6rem 0.85rem',
                background: '#121215',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.8rem',
              }}
            >
              <div>
                Zero Flag (Z):{' '}
                <strong style={{ color: cpuState?.flags.Z ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                  {cpuState?.flags.Z ? '1 (TRUE)' : '0'}
                </strong>
              </div>
              <div>
                Negative Flag (N):{' '}
                <strong style={{ color: cpuState?.flags.N ? 'var(--accent-rose)' : 'var(--text-dim)' }}>
                  {cpuState?.flags.N ? '1 (NEG)' : '0'}
                </strong>
              </div>
            </div>
          </div>

          {/* Memory Inspector */}
          <div className="glass-panel" style={{ padding: '1.15rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Data Memory Inspector
              </h3>
              <input
                type="text"
                className="form-input"
                placeholder="Filter addr..."
                value={memoryFilter}
                onChange={(e) => setMemoryFilter(e.target.value)}
                style={{ width: '110px', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
              />
            </div>

            <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Hex</th>
                    <th>Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {cpuState && Object.keys(cpuState.memory).length > 0 ? (
                    Object.entries(cpuState.memory)
                      .filter(([addr]) => (memoryFilter ? addr.includes(memoryFilter) : true))
                      .map(([addr, val]) => {
                        const prevMemVal = prevCpuState?.memory[addr];
                        const isChanged = prevMemVal !== val;
                        return (
                          <tr key={addr}>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                              MEM[{addr}]
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              <span className={isChanged ? 'val-highlight' : undefined}>{toHex(val)}</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              <span className={isChanged ? 'val-highlight' : undefined}>{val}</span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '1.5rem' }}>
                        No memory writes yet (use STORE R1, [100] to write RAM)
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
