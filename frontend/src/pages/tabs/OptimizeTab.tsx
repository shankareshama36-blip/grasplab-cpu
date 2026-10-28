import React, { useState, useEffect } from 'react';
import { Program, RunResult } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface OptimizeTabProps {
  currentProgram: Program | null;
  sourceCode: string;
  preset: string;
  programName: string;
  onBackToEditor: () => void;
}

export const OptimizeTab: React.FC<OptimizeTabProps> = ({
  currentProgram,
  sourceCode,
  preset,
  programName,
  onBackToEditor,
}) => {
  const { showToast } = useToast();
  const [forwarding, setForwarding] = useState<boolean>(true);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<number>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);

  // Amdahl's Law interactive state
  const [parallelFraction, setParallelFraction] = useState<number>(0.75);
  const [speedupFactor, setSpeedupFactor] = useState<number>(8);
  const [amdahlData, setAmdahlData] = useState<any>(null);

  const executePipelineRun = async (recordToDb: boolean = false) => {
    if (!sourceCode.trim()) return;
    setIsLoading(true);
    setIsAutoPlaying(false);
    try {
      const res = await api.runProgram(currentProgram?.id ?? null, {
        assembly_source: sourceCode,
        isa_preset: preset,
        forwarding_enabled: forwarding,
        max_cycles: 120,
        record_run: recordToDb,
      });
      setRunResult(res);
      setSelectedCycle(1);
      if (recordToDb) {
        showToast(`Pipeline run recorded! Effective CPI: ${res.cpi}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Pipeline analysis error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    executePipelineRun(false);
  }, [currentProgram?.id, sourceCode, preset, forwarding]);

  useEffect(() => {
    api.calculateAmdahl(parallelFraction, speedupFactor).then(setAmdahlData).catch(() => {});
  }, [parallelFraction, speedupFactor]);

  const pipelineTrace = runResult?.pipeline_trace || [];
  const currentPipelineState = pipelineTrace[selectedCycle - 1];

  // Auto-play pipeline cycles
  useEffect(() => {
    if (!isAutoPlaying || pipelineTrace.length === 0) return;
    if (selectedCycle >= pipelineTrace.length) {
      setIsAutoPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSelectedCycle((prev) => {
        if (prev >= pipelineTrace.length) {
          setIsAutoPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isAutoPlaying, selectedCycle, pipelineTrace.length]);

  const fwdComp = runResult?.forwarding_comparison;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Pipeline Controls */}
      <div
        className="glass-panel"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.15rem' }}>🚀</span>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                5-Stage Pipeline Analyzer: <span style={{ color: '#a5b4fc' }}>{programName || 'Scratchpad'}</span>
              </h3>
            </div>
            <span className="badge badge-blue">{preset}</span>
          </div>

          {/* Forwarding Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: '#121215',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Operand Forwarding:</span>
            <button
              onClick={() => setForwarding(!forwarding)}
              className={`btn ${forwarding ? 'btn-accent' : 'btn-danger'} btn-sm`}
              style={{ borderRadius: '9999px', padding: '0.2rem 0.75rem', fontSize: '0.74rem' }}
            >
              {forwarding ? '✓ ENABLED (ALU/MEM Bypass ON)' : '✕ DISABLED (Wait for WB)'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={onBackToEditor} className="btn btn-secondary btn-sm">
            ← Edit Assembly
          </button>
          <button
            onClick={() => executePipelineRun(true)}
            disabled={isLoading}
            className="btn btn-primary btn-sm"
            title="Run and save official telemetry to classroom history"
          >
            {isLoading ? 'Simulating...' : '⚡ Record Official Run'}
          </button>
        </div>
      </div>

      {/* 70/30 Layout */}
      <div className="layout-70-30">
        {/* Left Column (70%): 5-Stage Animator + Space-Time Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 5-Stage Cards with Active Drop-Shadow Glow & Timeline Scrubber */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pipeline Stage Registers — Cycle {selectedCycle} of {pipelineTrace.length || 1}
              </h3>

              {/* Cycle Scrubber & Auto-Play */}
              {pipelineTrace.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setSelectedCycle(1);
                    }}
                    disabled={selectedCycle <= 1}
                    className="btn btn-secondary btn-sm"
                    title="First Cycle"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setSelectedCycle(Math.max(1, selectedCycle - 1));
                    }}
                    disabled={selectedCycle <= 1}
                    className="btn btn-secondary btn-sm"
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => {
                      if (isAutoPlaying) {
                        setIsAutoPlaying(false);
                      } else {
                        if (selectedCycle >= pipelineTrace.length) setSelectedCycle(1);
                        setIsAutoPlaying(true);
                      }
                    }}
                    className={`btn ${isAutoPlaying ? 'btn-danger' : 'btn-primary'} btn-sm`}
                  >
                    {isAutoPlaying ? '⏸ Pause' : '⏯ Animate'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setSelectedCycle(Math.min(pipelineTrace.length, selectedCycle + 1));
                    }}
                    disabled={selectedCycle >= pipelineTrace.length}
                    className="btn btn-secondary btn-sm"
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>

            {pipelineTrace.length > 1 && (
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range"
                  min={1}
                  max={pipelineTrace.length}
                  value={selectedCycle}
                  onChange={(e) => {
                    setIsAutoPlaying(false);
                    setSelectedCycle(Number(e.target.value));
                  }}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  Cycle #{selectedCycle}
                </span>
              </div>
            )}

            {/* Stage Cards: IF, ID, EX, MEM, WB */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.75rem',
                minWidth: '580px',
                overflowX: 'auto',
              }}
            >
              {(
                [
                  { key: 'IF', label: '1. IF (Fetch)' },
                  { key: 'ID', label: '2. ID (Decode)' },
                  { key: 'EX', label: '3. EX (Execute)' },
                  { key: 'MEM', label: '4. MEM (Access)' },
                  { key: 'WB', label: '5. WB (Writeback)' },
                ] as const
              ).map(({ key: stageKey, label }) => {
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
                      padding: '0.9rem 0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      minHeight: '118px',
                      boxShadow: hasInstruction
                        ? '0 0 16px rgba(99, 102, 241, 0.3), inset 0 0 8px rgba(99, 102, 241, 0.08)'
                        : isBubble
                        ? '0 0 12px rgba(244, 63, 94, 0.2)'
                        : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{label}</strong>
                      {isBubble ? (
                        <span className="badge badge-rose" style={{ fontSize: '0.6rem' }}>BUBBLE</span>
                      ) : hasInstruction ? (
                        <span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>EMPTY</span>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {isBubble ? (
                        <div style={{ color: 'var(--accent-rose)', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          NOP (Stall/Flush)
                        </div>
                      ) : hasInstruction ? (
                        <>
                          <div style={{ color: '#a5b4fc', fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                            {stageData.opcode}
                          </div>
                          <div
                            style={{
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)',
                              marginTop: '0.15rem',
                            }}
                            title={stageData.raw}
                          >
                            {stageData.raw}
                          </div>
                          {stageData.line_no > 0 && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                              Source Line {stageData.line_no}
                            </span>
                          )}
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Cycle Events: Forwarding & Hazards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
              {currentPipelineState && currentPipelineState.forwarding_events.length > 0 && (
                <div
                  className="fade-in"
                  style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    fontSize: '0.8rem',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>⚡ <strong>Bypass Path Active:</strong></span>
                  {currentPipelineState.forwarding_events.map((fe, idx) => (
                    <span key={idx} style={{ fontFamily: 'var(--font-mono)' }}>
                      {fe.description}
                    </span>
                  ))}
                </div>
              )}

              {currentPipelineState &&
                currentPipelineState.active_hazards
                  .filter((h) => h.resolved_by !== 'forwarding')
                  .map((hz, idx) => (
                    <div
                      key={idx}
                      className="fade-in"
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: '8px',
                        background:
                          hz.hazard_type === 'control'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(244, 63, 94, 0.12)',
                        border:
                          hz.hazard_type === 'control'
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : '1px solid rgba(244, 63, 94, 0.4)',
                        fontSize: '0.8rem',
                        color: hz.hazard_type === 'control' ? '#fbbf24' : '#fda4af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                      }}
                    >
                      <span>⚠️ <strong>{hz.hazard_type.toUpperCase()} HAZARD:</strong></span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{hz.description}</span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Time-Space Instruction Grid Matrix */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Space-Time Pipeline Progression Matrix ({pipelineTrace.length} Cycles)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Click any cycle row to inspect stage registers above
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: '310px', overflowY: 'auto' }}>
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
                  {pipelineTrace.map((ps, idx) => {
                    const isSelected = ps.cycle === selectedCycle;
                    return (
                      <tr
                        key={idx}
                        onClick={() => {
                          setIsAutoPlaying(false);
                          setSelectedCycle(ps.cycle);
                        }}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.22)' : undefined,
                        }}
                      >
                        <td
                          style={{
                            textAlign: 'left',
                            fontWeight: isSelected ? 700 : 400,
                            color: isSelected ? '#a5b4fc' : 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          Cycle #{ps.cycle}
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
                                color: isBubble
                                  ? 'var(--accent-rose)'
                                  : val === 'empty'
                                  ? 'var(--text-dim)'
                                  : '#a5b4fc',
                                fontWeight: isBubble ? 700 : 500,
                              }}
                            >
                              {isBubble ? (
                                <span className="badge badge-rose" style={{ fontSize: '0.62rem' }}>
                                  bubble
                                </span>
                              ) : val === 'empty' ? (
                                '·'
                              ) : (
                                val
                              )}
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

        {/* Right Column (30%): Hazards, Forwarding Comparison & Amdahl's Law Curve */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Hazards & Forwarding Impact Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
              Pipeline Telemetry & Hazard Breakdown
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Effective CPI
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {runResult ? runResult.cpi.toFixed(2) : '1.00'}
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Ideal = 1.00</span>
              </div>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pipeline Speedup
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {runResult ? `${runResult.pipeline_comparison.speedup}x` : '1.00x'}
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>vs Single-Cycle</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Hazards (RAW):</span>
                <strong style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.data ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Stall Cycles:</span>
                <strong style={{ color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.total_stalls ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Branch Flush Penalties:</span>
                <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.total_flushes ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Structural Contention:</span>
                <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{runResult?.hazards.structural ?? 0}</strong>
              </div>
            </div>

            {/* Forwarding ON vs OFF Comparison Box */}
            {fwdComp && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: '0.45rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Forwarding Bypass Impact</span>
                  <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                    {fwdComp.stalls_saved} Stalls Saved
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  <span>With Forwarding (ON):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                    {fwdComp.forwarding_on.stalls} stalls · CPI {fwdComp.forwarding_on.cpi.toFixed(2)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Without Forwarding (OFF):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)' }}>
                    {fwdComp.forwarding_off.stalls} stalls · CPI {fwdComp.forwarding_off.cpi.toFixed(2)}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Amdahl's Law Dashboard with Live SVG Speedup Curve */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
              Amdahl's Law Speedup Explorer
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
              S(s) = 1 / ((1 - p) + p / s)
            </p>

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Parallelizable Fraction (p):</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    {(parallelFraction * 100).toFixed(0)}%
                  </strong>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={parallelFraction}
                  onChange={(e) => setParallelFraction(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Parallel Cores / Speedup (s):</span>
                  <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    {speedupFactor}x
                  </strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="64"
                  step="1"
                  value={speedupFactor}
                  onChange={(e) => setSpeedupFactor(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* SVG Speedup Curve Chart */}
            {amdahlData && amdahlData.curve && (
              <div
                style={{
                  background: '#09090b',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.65rem',
                  marginBottom: '0.85rem',
                }}
              >
                <svg viewBox="0 0 260 110" style={{ width: '100%', height: 'auto' }}>
                  {/* Horizontal Asymptote */}
                  <line x1="25" y1="18" x2="245" y2="18" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3,3" />
                  <text x="242" y="14" fill="#06b6d4" fontSize="8" textAnchor="end">
                    Max Limit: {amdahlData.theoretical_max}x
                  </text>
                  {/* Axes */}
                  <line x1="25" y1="90" x2="245" y2="90" stroke="#3f3f46" strokeWidth="1" />
                  <line x1="25" y1="15" x2="25" y2="90" stroke="#3f3f46" strokeWidth="1" />
                  {/* Curve */}
                  {(() => {
                    const maxY = Math.max(4, Math.min(20, amdahlData.theoretical_max));
                    const pts = amdahlData.curve.map((pt: any, i: number) => {
                      const x = 25 + (i / (amdahlData.curve.length - 1)) * 215;
                      const y = 90 - Math.min(1, pt.overall_speedup / maxY) * 70;
                      return `${x},${y}`;
                    });
                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          points={pts.join(' ')}
                        />
                        {amdahlData.curve.map((pt: any, i: number) => {
                          const x = 25 + (i / (amdahlData.curve.length - 1)) * 215;
                          const y = 90 - Math.min(1, pt.overall_speedup / maxY) * 70;
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="3" fill="#10b981" />
                              <text x={x} y="102" fill="#71717a" fontSize="7" textAnchor="middle">
                                {pt.speedup_factor}x
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            {/* Results */}
            <div
              style={{
                background: '#121215',
                padding: '0.75rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Achieved Overall Speedup:</span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                  {amdahlData ? `${amdahlData.overall_speedup}x` : '1.0x'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Serial Bottleneck (1 - p):</span>
                <strong style={{ color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                  {((1 - parallelFraction) * 100).toFixed(0)}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
