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
      {/* Sub navigation as Segmented Control */}
      <div className="nav-tabs" style={{ alignSelf: 'flex-start' }}>
        <button
          className={`nav-tab-btn ${subTab === 'binary' ? 'active' : ''}`}
          onClick={() => setSubTab('binary')}
        >
          <span>🔢</span> Binary & Two's Complement
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'gates' ? 'active' : ''}`}
          onClick={() => setSubTab('gates')}
        >
          <span>⚡</span> Gate Sandbox
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setSubTab('architecture')}
        >
          <span>🏛️</span> Von Neumann vs Harvard
        </button>
        <button
          className={`nav-tab-btn ${subTab === 'bus' ? 'active' : ''}`}
          onClick={() => setSubTab('bus')}
        >
          <span>🔌</span> Register Bus Explorer
        </button>
      </div>

      {/* 1. BINARY LAB */}
      {subTab === 'binary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              Interactive 8-Bit Number Representation
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Click any bit to flip it (0 ↔ 1) or type a signed decimal integer (-128 to 127) to observe two's complement encoding in real-time.
            </p>

            {/* Bit buttons */}
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
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
                      gap: '0.4rem',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: isSignBit ? 'var(--accent-rose)' : 'var(--text-dim)', fontWeight: 600 }}>
                      {isSignBit ? 'SIGN' : `2^${7 - idx}`}
                    </span>
                    <button
                      onClick={() => toggleBit(idx)}
                      style={{
                        width: '48px',
                        height: '56px',
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '8px',
                        border: bit === 1 ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: bit === 1 ? 'rgba(99, 102, 241, 0.22)' : '#18181b',
                        color: bit === 1 ? '#a5b4fc' : 'var(--text-dim)',
                        cursor: 'pointer',
                        boxShadow: bit === 1 ? '0 0 16px rgba(99, 102, 241, 0.45)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {bit}
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ background: '#121215', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signed (2's Comp)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {intInput}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unsigned Decimal</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a5b4fc', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {bits.reduce((acc, bit, i) => acc + (bit << (7 - i)), 0)}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hexadecimal</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {twosBreakdown ? twosBreakdown.hex : '0x00'}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decimal Direct Input</span>
                <input
                  type="number"
                  min="-128"
                  max="127"
                  className="form-input"
                  value={intInput}
                  onChange={handleIntChange}
                  style={{ marginTop: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* Step-by-step conversion steps */}
            {twosBreakdown && (
              <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '1.15rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Mathematical Conversion Steps:
                </h4>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              Digital Logic Gate Sandbox
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Test basic logic primitives. Toggle inputs A and B to observe boolean propagation and inspect the active row in the truth table.
            </p>

            {/* Gate selector */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
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
                gap: '2.5rem',
                padding: '2.5rem',
                background: '#121215',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                marginBottom: '1.75rem',
              }}
            >
              {/* Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <button
                  onClick={() => setInputA(inputA === 1 ? 0 : 1)}
                  className={`btn ${inputA === 1 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: '120px', padding: '0.65rem 1rem' }}
                >
                  Input A: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputA}</strong>
                </button>
                {gateOp !== 'NOT' && (
                  <button
                    onClick={() => setInputB(inputB === 1 ? 0 : 1)}
                    className={`btn ${inputB === 1 ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ minWidth: '120px', padding: '0.65rem 1rem' }}
                  >
                    Input B: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputB}</strong>
                  </button>
                )}
              </div>

              {/* Gate Symbol with Glowing Gradient */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '110px',
                  height: '110px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                  border: '2px solid var(--accent)',
                  boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)',
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#a5b4fc',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {gateOp}
              </div>

              {/* Output */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Output Q</span>
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    background: gateOutput === 1 ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.15)',
                    border: gateOutput === 1 ? '2px solid var(--accent-emerald)' : '2px solid var(--accent-rose)',
                    color: gateOutput === 1 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    boxShadow: gateOutput === 1 ? '0 0 25px rgba(16, 185, 129, 0.5)' : 'none',
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
                          backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.16)' : undefined,
                          fontWeight: isCurrent ? 700 : 400,
                        }}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{rowA}</td>
                        {gateOp !== 'NOT' && <td style={{ fontFamily: 'var(--font-mono)' }}>{rowB}</td>}
                        <td style={{ color: expectedOut === 1 ? 'var(--accent-emerald)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="fade-in">
          <div className="layout-70-30">
            {/* Left 70%: Architectural comparison diagrams */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Von Neumann */}
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Von Neumann Architecture
                  </h3>
                  <span className="badge badge-amber">Single Unified Bus</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Shares memory and bus for both Program Instructions and Data. Causes the classic <em>Von Neumann Bottleneck</em> when fetching an instruction while loading/storing data.
                </p>
                <div
                  style={{
                    background: '#121215',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>CPU Core</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>Control + ALU + Regs</div>
                  </div>
                  <div style={{ color: 'var(--accent-amber)', fontWeight: 600, fontSize: '0.85rem' }}>
                    ⟷ Shared Address & Data Bus ⟷
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Unified Memory</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>Code + Data combined</div>
                  </div>
                </div>
              </div>

              {/* Harvard */}
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Harvard Architecture
                  </h3>
                  <span className="badge badge-green">Dual Parallel Buses</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Separates instruction and data storage/signal pathways physically. Allows simultaneous instruction fetch and memory operand read/write without structural hazards.
                </p>
                <div
                  style={{
                    background: '#121215',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.75rem 1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      CPU Instruction Unit
                    </div>
                    <div style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.8rem' }}>
                      ⟷ Instruction Bus ⟷
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '8px', border: '1px solid var(--accent-cyan)' }}>
                      Instruction Memory (ROM/Cache)
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.75rem 1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      CPU Execution & ALU
                    </div>
                    <div style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.8rem' }}>
                      ⟷ Data Bus ⟷
                    </div>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', border: '1px solid var(--accent-emerald)' }}>
                      Data Memory (RAM/Cache)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 30%: Comparison Matrix */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Architecture Matrix
              </h4>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Pipeline Hazard Impact:</strong>
                  <p style={{ marginTop: '0.25rem', lineHeight: 1.6 }}>
                    In 5-stage pipelines, Von Neumann requires either dual-porting or stalls during LOAD/STORE. Harvard prevents structural memory stalls.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Modern Hybrid Use:</strong>
                  <p style={{ marginTop: '0.25rem', lineHeight: 1.6 }}>
                    Modern x86 and ARM processors use a Modified Harvard architecture inside the chip (separate L1 Instruction and L1 Data caches) with a unified Von Neumann main RAM outside.
                  </p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Hardware Complexity:</strong>
                  <p style={{ marginTop: '0.25rem', lineHeight: 1.6 }}>
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
        <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
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
                  background: '#121215',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Register R{i}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
                  0x0000
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                  Dec: 0
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '1.25rem',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
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
