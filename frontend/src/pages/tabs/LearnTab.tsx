import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export const LearnTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'binary' | 'gates' | 'architecture' | 'bus'>('binary');

  // Binary Lab State
  const [bits, setBits] = useState<number[]>([1, 1, 1, 1, 1, 0, 1, 1]); // default -5 in 8-bit
  const [intInput, setIntInput] = useState<string>('-5');
  const [twosBreakdown, setTwosBreakdown] = useState<any>(null);

  // Logic Gate Sandbox State
  const [gateOp, setGateOp] = useState<'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR'>('AND');
  const [inputA, setInputA] = useState<number>(1);
  const [inputB, setInputB] = useState<number>(0);

  // Fetch Two's complement breakdown
  useEffect(() => {
    const val = parseInt(intInput, 10);
    if (!isNaN(val)) {
      api.getTwosComplement(val, 8).then(setTwosBreakdown).catch(() => {});
    }
  }, [intInput]);

  const toggleBit = (index: number) => {
    const nextBits = [...bits];
    nextBits[index] = nextBits[index] === 1 ? 0 : 1;
    setBits(nextBits);

    // Compute signed decimal from 8-bit two's complement
    const unsignedVal = nextBits.reduce((acc, bit, i) => acc + (bit << (7 - i)), 0);
    const signedVal = (nextBits[0] === 1) ? unsignedVal - 256 : unsignedVal;
    setIntInput(signedVal.toString());
  };

  const handleIntChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setIntInput(raw);
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(-128, Math.min(127, val));
      const unsigned = (clamped < 0) ? 256 + clamped : clamped;
      const bitArr = [];
      for (let i = 7; i >= 0; i--) {
        bitArr.push((unsigned >> i) & 1);
      }
      setBits(bitArr);
    }
  };

  // Compute Gate Output
  const computeGate = (op: string, a: number, b: number): number => {
    switch (op) {
      case 'AND': return a & b;
      case 'OR': return a | b;
      case 'NOT': return a === 0 ? 1 : 0;
      case 'XOR': return a ^ b;
      case 'NAND': return (a & b) === 1 ? 0 : 1;
      case 'NOR': return (a | b) === 1 ? 0 : 1;
      default: return 0;
    }
  };

  const gateOutput = computeGate(gateOp, inputA, inputB);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Sub navigation */}
      <div className="nav-tabs" style={{ alignSelf: 'flex-start' }}>
        <button
          className={`nav-tab-btn ${subTab === 'binary' ? 'active' : ''}`}
          onClick={() => setSubTab('binary')}
        >
          🔢 Binary & Two's Complement
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'gates' ? 'active' : ''}`}
          onClick={() => setSubTab('gates')}
        >
          ⚡ Gate Sandbox
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setSubTab('architecture')}
        >
          🏛️ Von Neumann vs Harvard
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'bus' ? 'active' : ''}`}
          onClick={() => setSubTab('bus')}
        >
          🔌 Register Bus Explorer
        </button>
      </div>

      {/* 1. BINARY LAB */}
      {subTab === 'binary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Interactive 8-Bit Interactive Flipper
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Click any bit to flip it (0 ↔ 1) or type a signed decimal integer (-128 to 127) to observe two's complement encoding in real-time.
            </p>

            {/* Bit buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {bits.map((bit, idx) => {
                const weight = Math.pow(2, 7 - idx);
                const isSignBit = idx === 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: isSignBit ? 'var(--accent-rose)' : 'var(--text-dim)', fontWeight: 600 }}>
                      {isSignBit ? 'SIGN' : `2^${7 - idx}`}
                    </span>
                    <button
                      onClick={() => toggleBit(idx)}
                      style={{
                        width: '46px',
                        height: '54px',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        borderRadius: 'var(--radius-sm)',
                        border: bit === 1 ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: bit === 1 ? 'rgba(59, 130, 246, 0.25)' : 'var(--bg-surface)',
                        color: bit === 1 ? '#60a5fa' : 'var(--text-dim)',
                        cursor: 'pointer',
                        boxShadow: bit === 1 ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {bit}
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {isSignBit ? '-128' : `+${weight}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Value Badges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed (2's Comp)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {intInput}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unsigned Decimal</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {bits.reduce((acc, bit, i) => acc + (bit << (7 - i)), 0)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hexadecimal</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {twosBreakdown ? twosBreakdown.hex : '0x00'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decimal Input</span>
                <input
                  type="number"
                  min="-128"
                  max="127"
                  className="form-input"
                  value={intInput}
                  onChange={handleIntChange}
                  style={{ marginTop: '0.2rem', padding: '0.35rem 0.5rem', fontSize: '1.1rem', fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Step-by-step conversion steps */}
            {twosBreakdown && (
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Mathematical Conversion Steps:
                </h4>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                  {twosBreakdown.steps.map((st: string, idx: number) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. GATE SANDBOX */}
      {subTab === 'gates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Digital Logic Gate Sandbox
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Test basic logic primitives. Toggle the inputs A and B to observe the boolean output and live truth table.
            </p>

            {/* Gate selector */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {(['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'] as const).map((op) => (
                <button
                  key={op}
                  className={`btn ${gateOp === op ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setGateOp(op)}
                >
                  {op}
                </button>
              ))}
            </div>

            {/* Interactive Gate Diagram */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2rem',
                padding: '2rem',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                marginBottom: '1.5rem',
              }}
            >
              {/* Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <button
                  onClick={() => setInputA(inputA === 1 ? 0 : 1)}
                  className={`btn ${inputA === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: '100px' }}
                >
                  Input A: <strong>{inputA}</strong>
                </button>
                {gateOp !== 'NOT' && (
                  <button
                    onClick={() => setInputB(inputB === 1 ? 0 : 1)}
                    className={`btn ${inputB === 1 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ minWidth: '100px' }}
                  >
                    Input B: <strong>{inputB}</strong>
                  </button>
                )}
              </div>

              {/* Gate Symbol */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100px',
                  height: '100px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #1e2c47 0%, #162035 100%)',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                {gateOp}
              </div>

              {/* Output */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Output</span>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    background: gateOutput === 1 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.15)',
                    border: gateOutput === 1 ? '2px solid var(--accent-emerald)' : '2px solid var(--accent-rose)',
                    color: gateOutput === 1 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    boxShadow: gateOutput === 1 ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {gateOutput}
                </div>
              </div>
            </div>

            {/* Truth Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Input A</th>
                    {gateOp !== 'NOT' && <th>Input B</th>}
                    <th>Output ({gateOp})</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(gateOp === 'NOT'
                    ? [[0], [1]]
                    : [
                        [0, 0],
                        [0, 1],
                        [1, 0],
                        [1, 1],
                      ]
                  ).map((row, idx) => {
                    const rowA = row[0];
                    const rowB = row[1] ?? 0;
                    const expectedOut = computeGate(gateOp, rowA, rowB);
                    const isCurrent =
                      gateOp === 'NOT'
                        ? rowA === inputA
                        : rowA === inputA && rowB === inputB;

                    return (
                      <tr
                        key={idx}
                        style={{
                          backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          fontWeight: isCurrent ? 700 : 400,
                        }}
                      >
                        <td>{rowA}</td>
                        {gateOp !== 'NOT' && <td>{rowB}</td>}
                        <td style={{ color: expectedOut === 1 ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
                          {expectedOut}
                        </td>
                        <td>
                          {isCurrent ? (
                            <span className="badge badge-blue">Active Input</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Inactive</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. VON NEUMANN VS HARVARD ARCHITECTURE */}
      {subTab === 'architecture' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="layout-70-30">
            {/* Left 70%: Architectural comparison diagrams */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Von Neumann */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>Von Neumann Architecture</h3>
                  <span className="badge badge-amber">Single Unified Bus</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Shares memory and bus for both Program Instructions and Data. Causes the classic <em>Von Neumann Bottleneck</em> when fetching an instruction while loading/storing data.
                </p>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <strong>CPU Core</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>Control + ALU + Regs</div>
                  </div>
                  <div style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
                    ⟷ Shared Address & Data Bus ⟷
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <strong>Unified Memory</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>Code + Data combined</div>
                  </div>
                </div>
              </div>

              {/* Harvard */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>Harvard Architecture</h3>
                  <span className="badge badge-green">Dual Parallel Buses</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Separates instruction and data storage/signal pathways physically. Allows simultaneous instruction fetch and memory operand read/write without structural hazards.
                </p>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      CPU Instruction Unit
                    </div>
                    <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.8rem' }}>
                      ⟷ Instruction Bus ⟷
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '6px', border: '1px solid var(--accent-cyan)' }}>
                      Instruction Memory (ROM/Cache)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      CPU Execution & ALU
                    </div>
                    <div style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.8rem' }}>
                      ⟷ Data Bus ⟷
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '6px', border: '1px solid var(--accent-emerald)' }}>
                      Data Memory (RAM/Cache)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 30%: Comparison Matrix */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Architecture Matrix</h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Pipeline Hazard Impact:</strong>
                  <p style={{ marginTop: '0.2rem' }}>
                    In 5-stage pipelines, Von Neumann requires either dual-porting or stalls during LOAD/STORE. Harvard prevents structural memory stalls.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Modern Hybrid Use:</strong>
                  <p style={{ marginTop: '0.2rem' }}>
                    Modern x86 and ARM processors use a Modified Harvard architecture inside the chip (separate L1 Instruction and L1 Data caches) with a unified Von Neumann main RAM outside.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Hardware Complexity:</strong>
                  <p style={{ marginTop: '0.2rem' }}>
                    Harvard requires twice as many address and data pins/lines, increasing silicon area and packaging cost.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. REGISTER BUS EXPLORER */}
      {subTab === 'bus' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Register File & Shared System Bus
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Inspect the internal 8 general-purpose registers (R0-R7) connected to the central Arithmetic Logic Unit (ALU) via dedicated source multiplexers and writeback lines.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Register R{i}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                  0x0000
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  Dec: 0
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '1.25rem',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: 'var(--text-main)',
              lineHeight: 1.6,
            }}
          >
            <strong>Bus Architecture Note:</strong> At each clock cycle, the Register File can read two source registers simultaneously (port A and port B) into the ALU, and write one destination register at the rising clock edge (port W).
          </div>
        </div>
      )}
    </div>
  );
};
