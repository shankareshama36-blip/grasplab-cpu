import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { InstructorProgram } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/common/Skeleton';

export const InstructorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [programs, setPrograms] = useState<InstructorProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<InstructorProgram | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOverview = async () => {
    setIsLoading(true);
    try {
      const data = await api.getInstructorPrograms();
      setPrograms(data);
      if (data.length > 0) {
        setSelectedProgram(data[0]);
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

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'I';
  const userName = user?.email ? user.email.split('@')[0] : 'Instructor';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      {/* Top Navbar with Glassmorphism */}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
                fontSize: '1rem',
              }}
            >
              🎓
            </div>
            <span>GraspLab Instructor Portal</span>
          </div>

          <div style={{ height: '18px', width: '1px', background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-blue">{user?.tenant_id}</span>
            <span className="badge badge-amber">Classroom Admin</span>
          </div>
        </div>

        {/* User Profile Avatar Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="user-avatar-pill">
            <div
              className="user-avatar-circle"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              title={user?.email}
            >
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {userName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user?.role || 'Instructor'}
              </span>
            </div>
          </div>

          <button onClick={logout} className="btn btn-secondary btn-sm" title="Sign out">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1.75rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Classroom Program Submissions & Pipeline Diagnostics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            Monitor student assembly code efficiency, detect unhandled RAW pipeline stalls, and audit CPI metrics across your organization.
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Skeleton height="50px" borderRadius="10px" />
            <Skeleton height="320px" borderRadius="12px" />
          </div>
        ) : programs.length === 0 ? (
          <div className="empty-state fade-in">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">No student submissions yet</h3>
            <p className="empty-state-desc">
              When students in your organization write and run assembly code, their execution records and hazard stats will appear here.
            </p>
          </div>
        ) : (
          /* 70/30 Grid Layout with distinct --bg-surface, --border, border-radius: 12px */
          <div className="layout-70-30 fade-in">
            {/* Left 70%: Student Programs Table */}
            <div
              className="glass-panel"
              style={{
                padding: '1.5rem',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tenant Programs ({programs.length})
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click a row to inspect detailed diagnostics
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
                    </tr>
                  </thead>
                  <tbody>
                    {programs.map((prog) => {
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
                          <td>{prog.runs_count} runs</td>
                          <td>
                            {prog.latest_run ? (
                              <strong style={{ color: 'var(--accent-emerald)' }}>
                                {prog.latest_run.cpi.toFixed(2)}
                              </strong>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>None</span>
                            )}
                          </td>
                          <td>
                            {prog.has_hazard_flags ? (
                              <span className="badge badge-rose">⚠️ Hazards Detected</span>
                            ) : (
                              <span className="badge badge-green">✓ Optimized</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 30%: Inspection Detail Panel */}
            <div
              className="glass-panel"
              style={{
                padding: '1.5rem',
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Submission Diagnostics
              </h3>

              {selectedProgram ? (
                <>
                  <div
                    style={{
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {selectedProgram.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Target Architecture: <strong>{selectedProgram.isa_preset}</strong>
                    </div>
                  </div>

                  {/* Latest run hazard breakdown */}
                  {selectedProgram.latest_run ? (
                    <div
                      style={{
                        background: '#121215',
                        padding: '1.15rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Latest Run Breakdown
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Execution Cycles:</span>
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedProgram.latest_run.cycles}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Cycles Per Instruction (CPI):</span>
                        <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                          {selectedProgram.latest_run.cpi.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Data Hazard Stalls:</span>
                        <strong style={{ color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                          {selectedProgram.latest_run.hazards.total_stalls || 0}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Control Branch Flushes:</span>
                        <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                          {selectedProgram.latest_run.hazards.total_flushes || 0}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                      No runs recorded for this program yet.
                    </div>
                  )}

                  {/* Run History List */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Recent Run History ({selectedProgram.runs.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {selectedProgram.runs.map((r, idx) => (
                        <div
                          key={r.id || idx}
                          style={{
                            padding: '0.6rem 0.85rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)' }}>Run #{r.id} ({r.cycles} cycles)</span>
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
                  Select a program from the left to inspect its detailed pipeline diagnostics.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
