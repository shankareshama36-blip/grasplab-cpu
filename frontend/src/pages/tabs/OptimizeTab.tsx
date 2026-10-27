import React, { useState, useEffect } from 'react';
import { Program, RunResult } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface OptimizeTabProps {
  currentProgram: Program | null;
}

export const OptimizeTab: React.FC<OptimizeTabProps> = ({ currentProgram }) => {
  const { showToast } = useToast();
  const [forwarding, setForwarding] = useState<boolean>(true);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);

  // Amdahl's Law interactive state
  const [parallelFraction, setParallelFraction] = useState<number>(0.75);
  const [speedupFactor, setSpeedupFactor] = useState<number>(4);
  const [amdahlData, setAmdahlData] = useState<any>(null);

  const executePipelineRun = async () => {
    if (!currentProgram) return;
    setIsLoading(true);
    try {
      const res = await api.runProgram(currentProgram.id, {
        forwarding_enabled: forwarding,
        max_cycles: 60,
      });
      setRunResult(res);
      setSelectedCycle(1);
    } catch (err: any) {
      showToast(err.message || 'Pipeline analysis error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentProgram) {
      executePipelineRun();
    }
  }, [currentProgram, forwarding]);

  useEffect(() => {
    api.calculateAmdahl(parallelFraction, speedupFactor).then(setAmdahlData).catch(() => {});
  }, [parallelFraction, speedupFactor]);

  const pipelineTrace = runResult?.pipeline_trace || [];
  const currentPipelineState = pipelineTrace[selectedCycle - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Pipeline Controls */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.15rem' }}>⚡</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              5-Stage Pipeline Engine (MIPS / RISC-V)
            </h3>
          </div>

          {/* Forwarding Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#121215',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Operand Forwarding:</span>
            <button
              onClick={() => setForwarding(!forwarding)}
              className={`btn ${forwarding ? 'btn-accent' : 'btn-danger'} btn-sm`}
              style={{ borderRadius: '9999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
            >
              {forwarding ? 'ENABLED (Bypassing ON)' : 'DISABLED (Stalls ON)'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={executePipelineRun}
            disabled={isLoading || !currentProgram}
            className="btn btn-primary btn-sm"
          >
            {isLoading ? 'Simulating Pipeline...' : '⚡ Re-analyze Pipeline'}
          </button>
        </div>
      </div>

      {/* 70/30 Layout with distinct --bg-surface, --border, border-radius: 12px */}
      <div className="layout-70-30">
        {/* Left Column (70%): 5-Stage Animator + Space-Time Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 5-Stage Cards with Active Drop-Shadow Glow */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Stage Execution State (Cycle {selectedCycle} of {pipelineTrace.length || 1})
              </h3>

              {/* Cycle Scrubber */}
              {pipelineTrace.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedCycle(Math.max(1, selectedCycle - 1))}
                    disabled={selectedCycle <= 1}
                    className="btn btn-secondary btn-sm"
                  >
                    ◀ Prev
                  </button>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', padding: '0 0.4rem' }}>
                    Cycle <strong style={{ color: 'var(--accent)' }}>{selectedCycle}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedCycle(Math.min(pipelineTrace.length, selectedCycle + 1))}
                    disabled={selectedCycle >= pipelineTrace.length}
                    className="btn btn-secondary btn-sm"
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>

            {/* Stage Cards: IF, ID, EX, MEM, WB with Glowing Drop Shadows */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.85rem',
                minWidth: '600px',
                overflowX: 'auto',
              }}
            >
              {(['IF', 'ID', 'EX', 'MEM', 'WB'] as const).map((stageKey) => {
                const stageData = currentPipelineState?.stages[stageKey];
                const isBubble = stageData?.is_bubble;
                const hasInstruction = stageData && !isBubble;

                return (
                  <div
                    key={stageKey}
                    style={{
                      background: isBubble
                        ? 'rgba(244, 63, 94, 0.1)'
                        : hasInstruction
                        ? 'rgba(99, 102, 241, 0.12)'
                        : '#121215',
                      border: isBubble
                        ? '1px dashed var(--accent-rose)'
                        : hasInstruction
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '1rem 0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      minHeight: '120px',
                      boxShadow: hasInstruction
                        ? '0 0 16px rgba(99, 102, 241, 0.35), inset 0 0 8px rgba(99, 102, 241, 0.1)'
                        : isBubble
                        ? '0 0 12px rgba(244, 63, 94, 0.25)'
                        : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                        {stageKey}
                      </strong>
                      {isBubble ? (
                        <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>STALL</span>
                      ) : hasInstruction ? (
                        <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>IDLE</span>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {isBubble ? (
                        <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          NOP / Bubble
                        </div>
                      ) : hasInstruction ? (
                        <>
                          <div style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
                            {stageData.opcode}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                            {stageData.raw}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>None</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Forwarding Event Banner with Accent Emerald Glow */}
            {currentPipelineState && currentPipelineState.forwarding_events.length > 0 && (
              <div
                className="fade-in"
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)',
                  fontSize: '0.825rem',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <span>⚡ <strong>Forwarding Active:</strong></span>
                {currentPipelineState.forwarding_events.map((fe, idx) => (
                  <span key={idx}>{fe.description}</span>
                ))}
              </div>
            )}
          </div>

          {/* Time-Space Instruction Grid Matrix with Zebra Striping & Row Selection */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Time-Space Pipeline Progression Diagram (Cycles 1..{Math.min(30, pipelineTrace.length)})
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click row to inspect that cycle
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: '290px', overflowY: 'auto' }}>
              <table className="data-table" style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Cycle</th>
                    <th>IF (Fetch)</th>
                    <th>ID (Decode)</th>
                    <th>EX (Execute)</th>
                    <th>MEM (Access)</th>
                    <th>WB (Writeback)</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineTrace.slice(0, 30).map((ps, idx) => {
                    const isSelected = ps.cycle === selectedCycle;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedCycle(ps.cycle)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : undefined,
                        }}
                      >
                        <td style={{ textAlign: 'left', fontWeight: isSelected ? 700 : 400, color: isSelected ? '#a5b4fc' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          #{ps.cycle}
                        </td>
                        {(['IF', 'ID', 'EX', 'MEM', 'WB'] as const).map((st) => {
                          const val = ps.diagram_row[st];
                          const isBubble = val === 'stall';
                          return (
                            <td
                              key={st}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.75rem',
                                color: isBubble ? 'var(--accent-rose)' : val === 'empty' ? 'var(--text-dim)' : '#a5b4fc',
                                fontWeight: isBubble ? 700 : 400,
                              }}
                            >
                              {isBubble ? <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>stall</span> : val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (30%): Hazards & Amdahl's Law Calculator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Hazards Summary Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
              Hazard Analysis & CPI Impact
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pipelined CPI
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {runResult ? runResult.cpi : '1.00'}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Pipeline Stalls
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {runResult ? runResult.hazards.total_stalls : 0}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Hazards (RAW):</span>
                <strong style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.data ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Control Hazards (Flushes):</span>
                <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.control ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Structural Contention:</span>
                <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.structural ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Amdahl's Law Dashboard */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Amdahl's Law Calculator
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1.25rem', fontFamily: 'var(--font-mono)' }}>
              S = 1 / ((1 - p) + p/s)
            </p>

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Parallel Fraction (p):</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {(parallelFraction * 100).toFixed(0)}%
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={parallelFraction}
                  onChange={(e) => setParallelFraction(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Enhancement Factor (s):</span>
                  <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    {speedupFactor}x
                  </strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={speedupFactor}
                  onChange={(e) => setSpeedupFactor(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Results */}
            <div
              style={{
                background: '#121215',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.825rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Effective Speedup:</span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                  {amdahlData ? `${amdahlData.overall_speedup}x` : '1.0x'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Theoretical Max (s→∞):</span>
                <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {amdahlData ? `${amdahlData.theoretical_max}x` : '1.0x'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
