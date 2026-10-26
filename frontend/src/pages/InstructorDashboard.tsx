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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(15, 22, 38, 0.85)',
          backdropFilter: 'blur(10px)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.2rem' }}>
            <span style={{ color: 'var(--primary)' }}>⚡</span> GraspLab Instructor Portal
          </div>
          <span className="badge badge-blue">{user?.tenant_id}</span>
          <span className="badge badge-amber">Instructor Mode</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user?.email}</span>
          <button onClick={logout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Classroom Program Submissions & Pipeline Diagnostics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitor student assembly code efficiency, detect unhandled RAW pipeline stalls, and audit CPI metrics across your tenant.
          </p>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Skeleton height="60px" />
            <Skeleton height="200px" />
          </div>
        ) : programs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">No student submissions yet</h3>
            <p className="empty-state-desc">
              When students in your organization write and run assembly code, their execution records and hazard stats will appear here.
            </p>
          </div>
        ) : (
          /* 70/30 Grid Layout */
          <div className="layout-70-30">
            {/* Left 70%: Student Programs Table */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                Tenant Programs ({programs.length})
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Program Name</th>
                      <th>ISA Preset</th>
                      <th>Runs</th>
                      <th>Latest CPI</th>
                      <th>Hazard Flags</th>
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
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>{prog.name}</td>
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
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Submission Diagnostics</h3>

              {selectedProgram ? (
                <>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {selectedProgram.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      ISA Architecture: {selectedProgram.isa_preset}
                    </div>
                  </div>

                  {/* Latest run hazard breakdown */}
                  {selectedProgram.latest_run ? (
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                      }}
                    >
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600 }}>Latest Run Breakdown</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Execution Cycles:</span>
                        <strong>{selectedProgram.latest_run.cycles}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>CPI:</span>
                        <strong style={{ color: 'var(--accent-emerald)' }}>
                          {selectedProgram.latest_run.cpi.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Data Hazard Stalls:</span>
                        <strong style={{ color: 'var(--accent-rose)' }}>
                          {selectedProgram.latest_run.hazards.total_stalls || 0}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Control Branch Flushes:</span>
                        <strong style={{ color: 'var(--accent-amber)' }}>
                          {selectedProgram.latest_run.hazards.total_flushes || 0}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                      No runs recorded for this program yet.
                    </div>
                  )}

                  {/* Run History List */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Recent Run History ({selectedProgram.runs.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {selectedProgram.runs.map((r, idx) => (
                        <div
                          key={r.id || idx}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>Run #{r.id} ({r.cycles} cycles)</span>
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>CPI {r.cpi.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
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
