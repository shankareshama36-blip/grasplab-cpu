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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>5-Stage Pipeline Engine</h3>

          {/* Forwarding Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-surface)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Operand Forwarding:</span>
            <button
              onClick={() => setForwarding(!forwarding)}
              className={`btn ${forwarding ? 'btn-accent' : 'btn-danger'} btn-sm`}
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

      {/* 70/30 Layout */}
      <div className="layout-70-30">
        {/* Left Column (70%): 5-Stage Animator + Space-Time Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 5-Stage Cards */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
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
                    ◀
                  </button>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                    Cycle {selectedCycle}
                  </span>
                  <button
                    onClick={() => setSelectedCycle(Math.min(pipelineTrace.length, selectedCycle + 1))}
                    disabled={selectedCycle >= pipelineTrace.length}
                    className="btn btn-secondary btn-sm"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            {/* Stage Cards: IF, ID, EX, MEM, WB */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.75rem',
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
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'var(--bg-surface)',
                      border: isBubble
                        ? '1px dashed var(--accent-rose)'
                        : hasInstruction
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem 0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      minHeight: '110px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{stageKey}</strong>
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
                        <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', fontWeight: 600 }}>
                          NOP / Bubble
                        </div>
                      ) : hasInstruction ? (
                        <>
                          <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem' }}>
                            {stageData.opcode}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

            {/* Forwarding Event Banner */}
            {currentPipelineState && currentPipelineState.forwarding_events.length > 0 && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--accent-emerald)',
                  fontSize: '0.8rem',
                  color: 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>⚡ <strong>Forwarding Active:</strong></span>
                {currentPipelineState.forwarding_events.map((fe, idx) => (
                  <span key={idx}>{fe.description}</span>
                ))}
              </div>
            )}
          </div>

          {/* Time-Space Instruction Grid Matrix */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Time-Space Pipeline Progression Diagram (Cycles 1..{Math.min(25, pipelineTrace.length)})
            </h3>
            <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
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
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        }}
                      >
                        <td style={{ textAlign: 'left', fontWeight: isSelected ? 700 : 400 }}>
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
                                color: isBubble ? 'var(--accent-rose)' : val === 'empty' ? 'var(--text-dim)' : 'var(--primary)',
                                fontWeight: isBubble ? 700 : 400,
                              }}
                            >
                              {val}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Hazards Summary Card */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Hazard Analysis & CPI Impact
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pipelined CPI</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {runResult ? runResult.cpi : '1.00'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pipeline Stalls</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                  {runResult ? runResult.hazards.total_stalls : 0}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Hazards (RAW):</span>
                <strong style={{ color: 'var(--primary)' }}>{runResult?.hazards.data ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Control Hazards (Flushes):</span>
                <strong style={{ color: 'var(--accent-amber)' }}>{runResult?.hazards.control ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Structural Contention:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{runResult?.hazards.structural ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Amdahl's Law Dashboard */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Amdahl's Law Calculator
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
              S = 1 / ((1 - p) + p/s)
            </p>

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span>Parallel Fraction (p):</span>
                  <strong>{(parallelFraction * 100).toFixed(0)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={parallelFraction}
                  onChange={(e) => setParallelFraction(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span>Enhancement Factor (s):</span>
                  <strong>{speedupFactor}x</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={speedupFactor}
                  onChange={(e) => setSpeedupFactor(parseInt(e.target.value, 10))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Results */}
            <div
              style={{
                background: 'var(--bg-surface)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Effective Speedup:</span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                  {amdahlData ? `${amdahlData.overall_speedup}x` : '1.0x'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Theoretical Max (s→∞):</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>
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
