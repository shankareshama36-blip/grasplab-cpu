import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InstructorProgram, Program } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/common/Skeleton';

interface InstructorDashboardProps {
  embedded?: boolean;
  onOpenProgramInSimulator?: (prog: Program) => void;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  embedded = false,
  onOpenProgramInSimulator,
}) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [programs, setPrograms] = useState<InstructorProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<InstructorProgram | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');
  const [hazardFilter, setHazardFilter] = useState<'all' | 'hazards' | 'optimized'>('all');

  const fetchOverview = async () => {
    setIsLoading(true);
    try {
      const data = await api.getInstructorPrograms();
      setPrograms(data);
      if (data.length > 0) {
        setSelectedProgram((prev) => data.find((d) => d.id === prev?.id) || data[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load instructor records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleSeedSamples = async () => {
    try {
      await api.seedSamplePrograms();
      showToast('Starter classroom programs seeded!', 'success');
      fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'Failed to seed programs', 'error');
    }
  };

  const filteredPrograms = programs.filter((p) => {
    const matchesText =
      !filterText ||
      p.name.toLowerCase().includes(filterText.toLowerCase()) ||
      p.isa_preset.toLowerCase().includes(filterText.toLowerCase());
    const matchesHazard =
      hazardFilter === 'all' ||
      (hazardFilter === 'hazards' && p.has_hazard_flags) ||
      (hazardFilter === 'optimized' && !p.has_hazard_flags);
    return matchesText && matchesHazard;
  });

  // Aggregate Classroom Metrics
  const totalPrograms = programs.length;
  const totalRuns = programs.reduce((acc, p) => acc + p.runs_count, 0);
  const programsWithRuns = programs.filter((p) => p.latest_run);
  const avgCpi =
    programsWithRuns.length > 0
      ? programsWithRuns.reduce((acc, p) => acc + (p.latest_run?.cpi || 1), 0) / programsWithRuns.length
      : 1.0;
  const hazardFlaggedCount = programs.filter((p) => p.has_hazard_flags).length;

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'I';
  const userName = user?.email ? user.email.split('@')[0] : 'Instructor';

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header & Refresh */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            🎓 Classroom Program Submissions & Pipeline Diagnostics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Audit student assembly efficiency, inspect source code, and open any submission directly in the simulator.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={fetchOverview} className="btn btn-secondary btn-sm">
            🔄 Refresh Telemetry
          </button>
        </div>
      </div>

      {/* 4 Classroom KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Tenant Programs
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            {totalPrograms}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Workspace: {user?.tenant_id}</span>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Recorded Runs
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#a5b4fc', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            {totalRuns}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Across all ISA presets</span>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Average Classroom CPI
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            {avgCpi.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Lower is better (Ideal = 1.00)</span>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Programs with Hazards
          </span>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: hazardFlaggedCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
            {hazardFlaggedCount} / {totalPrograms}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Stalls or branch flushes detected</span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Skeleton height="50px" borderRadius="10px" />
          <Skeleton height="320px" borderRadius="12px" />
        </div>
      ) : programs.length === 0 ? (
        <div className="empty-state fade-in">
          <div className="empty-state-icon">📋</div>
          <h3 className="empty-state-title">No student submissions in this tenant yet</h3>
          <p className="empty-state-desc">
            Seed the 4 starter benchmark programs to inspect pipeline diagnostics immediately, or create a new program in the Simulator.
          </p>
          <button onClick={handleSeedSamples} className="btn btn-primary">
            📦 Seed 4 Starter Benchmark Programs
          </button>
        </div>
      ) : (
        <div className="layout-70-30 fade-in">
          {/* Left 70%: Student Programs Table */}
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search program or ISA..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  style={{ width: '210px', padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                />
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {(['all', 'hazards', 'optimized'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setHazardFilter(f)}
                      className={`btn ${hazardFilter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Showing {filteredPrograms.length} of {programs.length} programs
              </span>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Program Name</th>
                    <th>ISA Preset</th>
                    <th>Runs</th>
                    <th>Latest CPI</th>
                    <th>Hazard Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map((prog) => {
                    const isSelected = selectedProgram?.id === prog.id;
                    return (
                      <tr
                        key={prog.id}
                        onClick={() => setSelectedProgram(prog)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.16)' : undefined,
                        }}
                      >
                        <td style={{ fontWeight: 600, color: isSelected ? '#a5b4fc' : 'var(--text-primary)' }}>
                          {prog.name}
                        </td>
                        <td>
                          <span className="badge badge-blue">{prog.isa_preset}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{prog.runs_count}</td>
                        <td>
                          {prog.latest_run ? (
                            <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                              {prog.latest_run.cpi.toFixed(2)}
                            </strong>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {prog.has_hazard_flags ? (
                            <span className="badge badge-rose">⚠️ Hazards Detected</span>
                          ) : (
                            <span className="badge badge-green">✓ Clean Pipeline</span>
                          )}
                        </td>
                        <td>
                          {onOpenProgramInSimulator && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenProgramInSimulator({
                                  id: prog.id,
                                  tenant_id: user?.tenant_id || '',
                                  name: prog.name,
                                  assembly_source: prog.assembly_source || '',
                                  isa_preset: prog.isa_preset,
                                  status: prog.status,
                                  created_at: prog.created_at,
                                });
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
                            >
                              🛠️ Simulate →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 30%: Inspection Detail & Source Code Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Submission Inspector
              </h3>
              {selectedProgram && onOpenProgramInSimulator && (
                <button
                  onClick={() =>
                    onOpenProgramInSimulator({
                      id: selectedProgram.id,
                      tenant_id: user?.tenant_id || '',
                      name: selectedProgram.name,
                      assembly_source: selectedProgram.assembly_source || '',
                      isa_preset: selectedProgram.isa_preset,
                      status: selectedProgram.status,
                      created_at: selectedProgram.created_at,
                    })
                  }
                  className="btn btn-primary btn-sm"
                >
                  🛠️ Open in Simulator
                </button>
              )}
            </div>

            {selectedProgram ? (
              <>
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#a5b4fc' }}>
                    {selectedProgram.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Architecture: <strong>{selectedProgram.isa_preset}</strong> · {selectedProgram.runs_count} Recorded Runs
                  </div>
                </div>

                {/* Assembly Source Code Preview */}
                {selectedProgram.assembly_source && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Submitted Assembly Source
                    </h4>
                    <pre
                      style={{
                        background: '#09090b',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.76rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#e4e4e7',
                        maxHeight: '165px',
                        overflowY: 'auto',
                        lineHeight: 1.5,
                      }}
                    >
                      {selectedProgram.assembly_source}
                    </pre>
                  </div>
                )}

                {/* Latest run hazard breakdown */}
                {selectedProgram.latest_run ? (
                  <div
                    style={{
                      background: '#121215',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <h4 style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Latest Run Telemetry (Run #{selectedProgram.latest_run.id})
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Execution Cycles:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedProgram.latest_run.cycles}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Effective CPI:</span>
                      <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                        {selectedProgram.latest_run.cpi.toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Data Hazard Stalls:</span>
                      <strong style={{ color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                        {selectedProgram.latest_run.hazards.total_stalls || 0}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Control Branch Flushes:</span>
                      <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                        {selectedProgram.latest_run.hazards.total_flushes || 0}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.75rem' }}>
                    No runs recorded for this program yet.
                  </div>
                )}

                {/* Run History List */}
                <div>
                  <h4 style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Run History ({selectedProgram.runs.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {selectedProgram.runs.map((r, idx) => (
                      <div
                        key={r.id || idx}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          Run #{r.id} ({r.cycles} cyc, {r.hazards?.total_stalls || 0} stalls)
                        </span>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          CPI {r.cpi.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 1rem' }}>
                Select a program from the left table to inspect its code and pipeline diagnostics.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(24, 24, 27, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '0.75rem 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontWeight: 800, fontSize: '1.25rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              🎓
            </div>
            <span>GraspLab Instructor Portal</span>
          </div>
          <span className="badge badge-blue">{user?.tenant_id}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="user-avatar-pill">
            <div className="user-avatar-circle" title={user?.email}>
              {userInitial}
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{userName}</span>
          </div>
          <button onClick={logout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '1.75rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {content}
      </main>
    </div>
  );
};
