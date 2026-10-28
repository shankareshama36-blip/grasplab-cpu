import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export const LearnTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'binary' | 'gates' | 'architecture' | 'bus'>('binary');

  // 1. Binary Lab & Bitwise ALU State
  const [bits, setBits] = useState<number[]>([1, 1, 1, 1, 1, 0, 1, 1]); // -5 in 8-bit
  const [intInput, setIntInput] = useState<string>('-5');
  const [twosBreakdown, setTwosBreakdown] = useState<any>(null);

  const [bwOp, setBwOp] = useState<'AND' | 'OR' | 'XOR' | 'NOT' | 'SHL' | 'SHR'>('AND');
  const [bwVal1, setBwVal1] = useState<number>(42);
  const [bwVal2, setBwVal2] = useState<number>(15);
  const [bwResult, setBwResult] = useState<any>(null);

  // 2. Logic Gate & Half-Adder Sandbox State
  const [circuitMode, setCircuitMode] = useState<'single' | 'half-adder'>('half-adder');
  const [gateOp, setGateOp] = useState<'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR'>('AND');
  const [inputA, setInputA] = useState<number>(1);
  const [inputB, setInputB] = useState<number>(1);

  // 3. Von Neumann vs Harvard Simulation Step
  const [archStep, setArchStep] = useState<0 | 1 | 2>(1);

  // 4. Interactive Register Bus Explorer State
  const [busRegs, setBusRegs] = useState<number[]>([0, 12, 7, 0, 25, 4, 0, 100]);
  const [portA, setPortA] = useState<number>(1);
  const [portB, setPortB] = useState<number>(2);
  const [portW, setPortW] = useState<number>(3);
  const [busAluOp, setBusAluOp] = useState<'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'MOV'>('ADD');
  const [lastBusTransfer, setLastBusTransfer] = useState<string>(
    'Ready: Select Source Ports A & B, ALU Operation, and Destination Port W, then trigger a clock edge.'
  );
  const [highlightedReg, setHighlightedReg] = useState<number | null>(3);

  // Fetch Two's complement breakdown
  useEffect(() => {
    const val = parseInt(intInput, 10);
    if (!isNaN(val)) {
      api.getTwosComplement(val, 8).then(setTwosBreakdown).catch(() => {});
    }
  }, [intInput]);

  // Fetch Bitwise operation breakdown
  useEffect(() => {
    api.getBitwise(bwOp, bwVal1, bwVal2, 8).then(setBwResult).catch(() => {});
  }, [bwOp, bwVal1, bwVal2]);

  const toggleBit = (index: number) => {
    const nextBits = [...bits];
    nextBits[index] = nextBits[index] === 1 ? 0 : 1;
    setBits(nextBits);

    const unsignedVal = nextBits.reduce((acc, bit, i) => acc + (bit << (7 - i)), 0);
    const signedVal = nextBits[0] === 1 ? unsignedVal - 256 : unsignedVal;
    setIntInput(signedVal.toString());
  };

  const handleIntChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setIntInput(raw);
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(-128, Math.min(127, val));
      const unsigned = clamped < 0 ? 256 + clamped : clamped;
      const bitArr = [];
      for (let i = 7; i >= 0; i--) {
        bitArr.push((unsigned >> i) & 1);
      }
      setBits(bitArr);
    }
  };

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
  const halfAdderSum = inputA ^ inputB;
  const halfAdderCarry = inputA & inputB;

  const computeBusAlu = (op: string, a: number, b: number): number => {
    switch (op) {
      case 'ADD': return a + b;
      case 'SUB': return a - b;
      case 'AND': return a & b;
      case 'OR': return a | b;
      case 'XOR': return a ^ b;
      case 'MOV': return a;
      default: return a;
    }
  };

  const currentValA = busRegs[portA] ?? 0;
  const currentValB = busRegs[portB] ?? 0;
  const currentAluResult = computeBusAlu(busAluOp, currentValA, currentValB);

  const handleExecuteBusClock = () => {
    const next = [...busRegs];
    next[portW] = currentAluResult;
    setBusRegs(next);
    setHighlightedReg(portW);
    const rtl =
      busAluOp === 'MOV'
        ? `R${portW} ← R${portA} (${currentValA})`
        : `R${portW} ← R${portA} ${busAluOp} R${portB} (${currentValA} ${busAluOp} ${currentValB} = ${currentAluResult})`;
    setLastBusTransfer(`Clock Rising Edge ↑ : ${rtl}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sub navigation as Segmented Control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="nav-tabs">
          <button
            className={`nav-tab-btn ${subTab === 'binary' ? 'active' : ''}`}
            onClick={() => setSubTab('binary')}
          >
            <span>🔢</span> Binary, 2's Comp & Bitwise
          </button>
          <button
            className={`nav-tab-btn ${subTab === 'gates' ? 'active' : ''}`}
            onClick={() => setSubTab('gates')}
          >
            <span>⚡</span> Logic Gates & Half-Adder
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
            <span>🔌</span> Interactive Register Bus
          </button>
        </div>
      </div>

      {/* 1. BINARY LAB & BITWISE PLAYGROUND */}
      {subTab === 'binary' && (
        <div className="layout-70-30 fade-in">
          {/* Left: 8-Bit Two's Complement Interactive Converter */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              Interactive 8-Bit Two's Complement Encoder
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.35rem' }}>
              Click any bit to toggle (0 ↔ 1) or enter a signed integer (-128 to 127) to inspect hardware sign-bit weighting.
            </p>

            {/* Bit buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
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
                    <span style={{ fontSize: '0.68rem', color: isSignBit ? 'var(--accent-rose)' : 'var(--text-dim)', fontWeight: 600 }}>
                      {isSignBit ? 'SIGN (b7)' : `b${7 - idx}`}
                    </span>
                    <button
                      onClick={() => toggleBit(idx)}
                      style={{
                        width: '48px',
                        height: '54px',
                        fontSize: '1.35rem',
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '0.85rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Signed (2's Comp)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {intInput}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unsigned Decimal</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a5b4fc', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {bits.reduce((acc, bit, i) => acc + (bit << (7 - i)), 0)}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hexadecimal</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {twosBreakdown ? twosBreakdown.hex : '0x00'}
                </div>
              </div>
              <div style={{ background: '#121215', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Set Signed Value</span>
                <input
                  type="number"
                  min="-128"
                  max="127"
                  className="form-input"
                  value={intInput}
                  onChange={handleIntChange}
                  style={{ marginTop: '0.25rem', padding: '0.35rem 0.55rem', fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {twosBreakdown && (
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Step-by-Step Conversion Breakdown:
                </h4>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.65, fontFamily: 'var(--font-mono)' }}>
                  {twosBreakdown.steps.map((st: string, idx: number) => (
                    <li key={idx}>{st}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: 8-Bit Bitwise ALU Calculator */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Bitwise ALU Playground
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Test register-width bitwise & shift operations.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {(['AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR'] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setBwOp(op)}
                  className={`btn ${bwOp === op ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                >
                  {op}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: bwOp === 'NOT' ? '1fr' : '1fr 1fr', gap: '0.65rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Operand A (0..255)</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  className="form-input"
                  value={bwVal1}
                  onChange={(e) => setBwVal1(Number(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              {bwOp !== 'NOT' && (
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    {bwOp === 'SHL' || bwOp === 'SHR' ? 'Shift Amount' : 'Operand B (0..255)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    className="form-input"
                    value={bwVal2}
                    onChange={(e) => setBwVal2(Number(e.target.value) || 0)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}
            </div>

            {bwResult && (
              <div
                style={{
                  background: '#121215',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Input A:</span>
                  <span style={{ color: '#a5b4fc' }}>{bwResult.binary_in1} ({bwVal1})</span>
                </div>
                {bwResult.binary_in2 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Input B ({bwOp}):</span>
                    <span style={{ color: '#a5b4fc' }}>{bwResult.binary_in2} ({bwVal2})</span>
                  </div>
                )}
                <div style={{ height: '1px', background: 'var(--border)', margin: '0.2rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span style={{ color: 'var(--accent-emerald)' }}>Result:</span>
                  <span style={{ color: 'var(--accent-emerald)' }}>
                    {bwResult.binary_out} ({bwResult.decimal_out} / {bwResult.hex_out})
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. GATE SANDBOX & HALF-ADDER CIRCUIT */}
      {subTab === 'gates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Digital Logic & Half-Adder Circuit Lab
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Toggle inputs A and B to trace signal propagation through combinational logic gates and binary adders.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setCircuitMode('half-adder')}
                  className={`btn ${circuitMode === 'half-adder' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  🔌 1-Bit Half-Adder Circuit
                </button>
                <button
                  onClick={() => setCircuitMode('single')}
                  className={`btn ${circuitMode === 'single' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  ⚡ Single Gate Primitives
                </button>
              </div>
            </div>

            {circuitMode === 'half-adder' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    background: '#09090b',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    padding: '1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    gap: '1.5rem',
                  }}
                >
                  {/* Interactive Input Switches */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <button
                      onClick={() => setInputA(inputA === 1 ? 0 : 1)}
                      className={`btn ${inputA === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minWidth: '135px' }}
                    >
                      Bit A = <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputA}</strong>
                    </button>
                    <button
                      onClick={() => setInputB(inputB === 1 ? 0 : 1)}
                      className={`btn ${inputB === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minWidth: '135px' }}
                    >
                      Bit B = <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputB}</strong>
                    </button>
                  </div>

                  {/* SVG Half-Adder Circuit Diagram */}
                  <svg viewBox="0 0 420 180" style={{ width: '100%', maxWidth: '440px', height: 'auto' }}>
                    {/* Input A wires */}
                    <path d="M 20 50 L 180 50" stroke={inputA ? '#10b981' : '#3f3f46'} strokeWidth="3" />
                    <path d="M 90 50 L 90 120 L 180 120" stroke={inputA ? '#10b981' : '#3f3f46'} strokeWidth="3" fill="none" />
                    {/* Input B wires */}
                    <path d="M 20 145 L 180 145" stroke={inputB ? '#06b6d4' : '#3f3f46'} strokeWidth="3" />
                    <path d="M 130 145 L 130 75 L 180 75" stroke={inputB ? '#06b6d4' : '#3f3f46'} strokeWidth="3" fill="none" />

                    {/* XOR Gate for SUM */}
                    <rect
                      x="180"
                      y="35"
                      width="90"
                      height="55"
                      rx="10"
                      fill="#18181b"
                      stroke={halfAdderSum ? '#10b981' : '#6366f1'}
                      strokeWidth="2"
                    />
                    <text x="225" y="60" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">
                      XOR Gate
                    </text>
                    <text x="225" y="76" fill="#a1a1aa" fontSize="9" textAnchor="middle">
                      A ⊕ B
                    </text>

                    {/* AND Gate for CARRY */}
                    <rect
                      x="180"
                      y="108"
                      width="90"
                      height="55"
                      rx="10"
                      fill="#18181b"
                      stroke={halfAdderCarry ? '#f59e0b' : '#6366f1'}
                      strokeWidth="2"
                    />
                    <text x="225" y="133" fill="#f4f4f5" fontSize="12" fontWeight="bold" textAnchor="middle">
                      AND Gate
                    </text>
                    <text x="225" y="149" fill="#a1a1aa" fontSize="9" textAnchor="middle">
                      A · B
                    </text>

                    {/* Output Wires */}
                    <path d="M 270 62 L 340 62" stroke={halfAdderSum ? '#10b981' : '#3f3f46'} strokeWidth="3" />
                    <path d="M 270 135 L 340 135" stroke={halfAdderCarry ? '#f59e0b' : '#3f3f46'} strokeWidth="3" />

                    <circle cx="365" cy="62" r="20" fill={halfAdderSum ? 'rgba(16,185,129,0.2)' : '#18181b'} stroke={halfAdderSum ? '#10b981' : '#3f3f46'} strokeWidth="2" />
                    <text x="365" y="67" fill={halfAdderSum ? '#34d399' : '#71717a'} fontSize="14" fontWeight="bold" textAnchor="middle">
                      {halfAdderSum}
                    </text>
                    <text x="365" y="34" fill="#a1a1aa" fontSize="10" textAnchor="middle">SUM (S)</text>

                    <circle cx="365" cy="135" r="20" fill={halfAdderCarry ? 'rgba(245,158,11,0.2)' : '#18181b'} stroke={halfAdderCarry ? '#f59e0b' : '#3f3f46'} strokeWidth="2" />
                    <text x="365" y="140" fill={halfAdderCarry ? '#fbbf24' : '#71717a'} fontSize="14" fontWeight="bold" textAnchor="middle">
                      {halfAdderCarry}
                    </text>
                    <text x="365" y="172" fill="#a1a1aa" fontSize="10" textAnchor="middle">CARRY (C)</text>
                  </svg>

                  {/* Arithmetic Summary Box */}
                  <div
                    style={{
                      background: '#121215',
                      padding: '1.25rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-mono)',
                      minWidth: '210px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Binary Addition Equation:
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {inputA} + {inputB} = {halfAdderCarry}{halfAdderSum}₂
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#a5b4fc', marginTop: '0.35rem' }}>
                      Decimal Value: {inputA + inputB}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
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

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2.5rem',
                    padding: '2rem',
                    background: '#121215',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button
                      onClick={() => setInputA(inputA === 1 ? 0 : 1)}
                      className={`btn ${inputA === 1 ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Input A: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputA}</strong>
                    </button>
                    {gateOp !== 'NOT' && (
                      <button
                        onClick={() => setInputB(inputB === 1 ? 0 : 1)}
                        className={`btn ${inputB === 1 ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        Input B: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inputB}</strong>
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100px',
                      height: '100px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                      border: '2px solid var(--accent)',
                      boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)',
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      color: '#a5b4fc',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {gateOp}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Output Q</span>
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        background: gateOutput === 1 ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.15)',
                        border: gateOutput === 1 ? '2px solid var(--accent-emerald)' : '2px solid var(--accent-rose)',
                        color: gateOutput === 1 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                      }}
                    >
                      {gateOutput}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. VON NEUMANN VS HARVARD ARCHITECTURE */}
      {subTab === 'architecture' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Memory Bus Contention Simulator: Executing <code style={{ color: '#a5b4fc' }}>LOAD R1, [100]</code>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Compare what happens when instruction fetch (IF) and data memory read (MEM) occur in a pipelined processor.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setArchStep(1)}
                className={`btn ${archStep === 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                Cycle 1: Instruction Fetch + Data Access
              </button>
              <button
                onClick={() => setArchStep(2)}
                className={`btn ${archStep === 2 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                Cycle 2: Resolution
              </button>
            </div>
          </div>

          <div className="layout-70-30">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Von Neumann */}
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Von Neumann Architecture (Unified Bus)
                  </h3>
                  <span className="badge badge-rose">
                    {archStep === 1 ? '⚠️ Structural Bus Hazard (Stall!)' : 'Cycle 2: Completes Delayed Fetch'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.15rem' }}>
                  {archStep === 1
                    ? 'Cycle 1: The single shared bus is busy reading Data [100], so the next Instruction Fetch MUST STALL!'
                    : 'Cycle 2: Now that Data [100] finished, the shared bus can finally fetch the next instruction (2 cycles total).'}
                </p>
                <div
                  style={{
                    background: '#121215',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ textAlign: 'center', padding: '0.85rem 1.1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>CPU Core</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>IF + MEM Stage</div>
                  </div>
                  <div style={{ color: archStep === 1 ? 'var(--accent-rose)' : 'var(--accent-amber)', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                    {archStep === 1 ? '⚡ BUS BUSY: DATA[100] (IF STALLED)' : '⟷ BUSY: FETCH NEXT INSTR ⟷'}
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.85rem 1.1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Unified RAM</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Code + Data Shared</div>
                  </div>
                </div>
              </div>

              {/* Harvard */}
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Harvard Architecture (Split Instruction & Data Buses)
                  </h3>
                  <span className="badge badge-green">✓ Zero Structural Stalls (1 Cycle)</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.15rem' }}>
                  Dedicated Instruction Bus and Data Bus operate simultaneously in Cycle 1 with zero contention.
                </p>
                <div
                  style={{
                    background: '#121215',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.65rem 1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      IF Stage
                    </div>
                    <div style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      ⟷ Fetching PC+1 Simultaneously ⟷
                    </div>
                    <div style={{ padding: '0.65rem 1rem', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '8px', border: '1px solid var(--accent-cyan)' }}>
                      L1 Instruction Cache
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ padding: '0.65rem 1rem', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      MEM Stage
                    </div>
                    <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      ⟷ Reading DATA[100] Simultaneously ⟷
                    </div>
                    <div style={{ padding: '0.65rem 1rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', border: '1px solid var(--accent-emerald)' }}>
                      L1 Data Cache
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Architectural Takeaways
              </h4>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.85rem', lineHeight: 1.6 }}>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>1. The Von Neumann Bottleneck:</strong>
                  <p>Without separate caches, every memory instruction (LOAD/STORE) competes with Instruction Fetch for the single memory port.</p>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>2. Modified Harvard in Modern CPUs:</strong>
                  <p>Modern RISC-V, ARM, and x86 chips use split L1I and L1D caches on-die (Harvard) backed by unified main DDR RAM (Von Neumann).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. INTERACTIVE REGISTER BUS EXPLORER */}
      {subTab === 'bus' && (
        <div className="glass-panel fade-in" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Interactive 3-Port Register File & Shared ALU Bus
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Configure Register Transfer Level (RTL) multiplexers: choose two read ports (A, B), an ALU operation, and a destination write port (W).
              </p>
            </div>
            <button
              onClick={() => {
                setBusRegs([0, 12, 7, 0, 25, 4, 0, 100]);
                setHighlightedReg(null);
                setLastBusTransfer('Reset registers to default initial values.');
              }}
              className="btn btn-secondary btn-sm"
            >
              ↺ Reset Registers
            </button>
          </div>

          {/* Interactive RTL Control Bar */}
          <div
            style={{
              background: '#121215',
              padding: '1.15rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              alignItems: 'end',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <label className="form-label">Read Port A (rs1)</label>
              <select className="form-select" value={portA} onChange={(e) => setPortA(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                  <option key={r} value={r}>
                    R{r} (val = {busRegs[r]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">ALU Operation</label>
              <select className="form-select" value={busAluOp} onChange={(e) => setBusAluOp(e.target.value as any)}>
                <option value="ADD">ADD (A + B)</option>
                <option value="SUB">SUB (A - B)</option>
                <option value="AND">AND (A & B)</option>
                <option value="OR">OR (A | B)</option>
                <option value="XOR">XOR (A ^ B)</option>
                <option value="MOV">MOV (Pass A)</option>
              </select>
            </div>

            {busAluOp !== 'MOV' && (
              <div>
                <label className="form-label">Read Port B (rs2)</label>
                <select className="form-select" value={portB} onChange={(e) => setPortB(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                    <option key={r} value={r}>
                      R{r} (val = {busRegs[r]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="form-label">Write Port W (rd)</label>
              <select className="form-select" value={portW} onChange={(e) => setPortW(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
                  <option key={r} value={r}>
                    R{r} (dest)
                  </option>
                ))}
              </select>
            </div>

            <button onClick={handleExecuteBusClock} className="btn btn-primary" style={{ height: '40px' }}>
              ⚡ Trigger Clock Edge
            </button>
          </div>

          {/* Register Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {busRegs.map((val, i) => {
              const isReadA = portA === i;
              const isReadB = busAluOp !== 'MOV' && portB === i;
              const isWriteW = portW === i;
              const isJustUpdated = highlightedReg === i;

              return (
                <div
                  key={i}
                  style={{
                    background: isJustUpdated ? 'rgba(16, 185, 129, 0.12)' : '#121215',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: isJustUpdated
                      ? '2px solid var(--accent-emerald)'
                      : isWriteW
                      ? '1px dashed var(--accent-amber)'
                      : isReadA || isReadB
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>R{i}</span>
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      {isReadA && <span className="badge badge-blue" style={{ fontSize: '0.58rem' }}>Port A</span>}
                      {isReadB && <span className="badge badge-cyan" style={{ fontSize: '0.58rem' }}>Port B</span>}
                      {isWriteW && <span className="badge badge-amber" style={{ fontSize: '0.58rem' }}>Port W</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isJustUpdated ? 'var(--accent-emerald)' : '#a5b4fc' }}>
                    0x{((val < 0 ? val + 0x10000 : val) & 0xffff).toString(16).toUpperCase().padStart(4, '0')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                    Dec: <strong>{val}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Bus Activity Banner */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <span>{lastBusTransfer}</span>
            <span className="badge badge-green">
              Combinational ALU Output = {currentAluResult}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
