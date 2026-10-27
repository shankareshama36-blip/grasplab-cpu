import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Program } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { LearnTab } from './tabs/LearnTab';
import { BuildTab } from './tabs/BuildTab';
import { OptimizeTab } from './tabs/OptimizeTab';
import { Modal } from '../components/common/Modal';
import { Skeleton } from '../components/common/Skeleton';

export const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'learn' | 'build' | 'optimize'>(() => {
    return (localStorage.getItem('grasplab_student_tab') as any) || 'build';
  });

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Program Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newProgName, setNewProgName] = useState<string>('');
  const [newProgPreset, setNewProgPreset] = useState<string>('RISC-V');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPrograms();
      setPrograms(data);
      if (data.length > 0 && !selectedProgram) {
        setSelectedProgram(data[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch programs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleTabChange = (tab: 'learn' | 'build' | 'optimize') => {
    setActiveTab(tab);
    localStorage.setItem('grasplab_student_tab', tab);
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim()) return;

    setIsCreating(true);
    const starterCode =
      newProgPreset === 'x86'
        ? 'mov eax, 5\nmov ebx, 10\nadd eax, ebx\nhlt'
        : 'LOAD R1, 5\nLOAD R2, 10\nADD R3, R1, R2\nHALT';

    try {
      const created = await api.createProgram(newProgName.trim(), starterCode, newProgPreset);
      setPrograms((prev) => [created, ...prev]);
      setSelectedProgram(created);
      setIsModalOpen(false);
      setNewProgName('');
      showToast(`Program "${created.name}" created!`, 'success');
      handleTabChange('build');
    } catch (err: any) {
      showToast(err.message || 'Could not create program', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProgram = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this program?')) return;
    try {
      await api.deleteProgram(id);
      const remaining = programs.filter((p) => p.id !== id);
      setPrograms(remaining);
      setSelectedProgram(remaining.length > 0 ? remaining[0] : null);
      showToast('Program deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete program', 'error');
    }
  };

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'S';
  const userName = user?.email ? user.email.split('@')[0] : 'Student';

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
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                fontSize: '1rem',
              }}
            >
              ⚡
            </div>
            <span>GraspLab</span>
          </div>

          <div style={{ height: '18px', width: '1px', background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-blue">{user?.tenant_id || 'workspace'}</span>
            <span className="badge badge-green">{user?.role || 'Student'}</span>
          </div>
        </div>

        {/* User Profile Avatar Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="user-avatar-pill">
            <div className="user-avatar-circle" title={user?.email}>
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {userName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user?.role || 'Student'}
              </span>
            </div>
          </div>

          <button onClick={logout} className="btn btn-secondary btn-sm" title="Sign out of GraspLab">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, padding: '1.75rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Workspace Sub-header & Navigation */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            marginBottom: '1.75rem',
          }}
        >
          {/* Main 3 Tabs Styled as Segmented Pill Control */}
          <div className="nav-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'learn'}
              className={`nav-tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
              onClick={() => handleTabChange('learn')}
            >
              <span>📘</span> Learn
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'build'}
              className={`nav-tab-btn ${activeTab === 'build' ? 'active' : ''}`}
              onClick={() => handleTabChange('build')}
            >
              <span>🛠️</span> Build
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'optimize'}
              className={`nav-tab-btn ${activeTab === 'optimize' ? 'active' : ''}`}
              onClick={() => handleTabChange('optimize')}
            >
              <span>🚀</span> Optimize
            </button>
          </div>

          {/* Program Switcher / New Program */}
          {activeTab !== 'learn' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isLoading ? (
                <Skeleton width="200px" height="36px" borderRadius="6px" />
              ) : (
                <select
                  className="form-select"
                  value={selectedProgram?.id || ''}
                  onChange={(e) => {
                    const found = programs.find((p) => p.id === parseInt(e.target.value, 10));
                    if (found) setSelectedProgram(found);
                  }}
                  style={{ width: '220px', fontSize: '0.85rem' }}
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.isa_preset})
                    </option>
                  ))}
                </select>
              )}

              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
                + New Program
              </button>

              {selectedProgram && (
                <button
                  onClick={() => handleDeleteProgram(selectedProgram.id)}
                  className="btn btn-danger btn-sm"
                  title="Delete current program"
                >
                  🗑️
                </button>
              )}
            </div>
          )}
        </div>

        {/* Empty State when no programs exist */}
        {!isLoading && programs.length === 0 && activeTab !== 'learn' ? (
          <div className="empty-state fade-in">
            <div className="empty-state-icon">📁</div>
            <h3 className="empty-state-title">No assembly programs yet</h3>
            <p className="empty-state-desc">
              Your tenant workspace has no saved assembly files. Create your first program to start stepping through instructions in the interactive CPU pipeline.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              + Create First Program
            </button>
          </div>
        ) : (
          <div className="fade-in">
            {activeTab === 'learn' && <LearnTab />}
            {activeTab === 'build' && (
              <BuildTab
                currentProgram={selectedProgram}
                onProgramUpdate={(updated) => {
                  setSelectedProgram(updated);
                  setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                }}
              />
            )}
            {activeTab === 'optimize' && <OptimizeTab currentProgram={selectedProgram} />}
          </div>
        )}
      </main>

      {/* New Program Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Assembly Program">
        <form onSubmit={handleCreateProgram}>
          <div className="form-group">
            <label className="form-label">Program Name</label>
            <input
              type="text"
              required
              className="form-input form-input-lg"
              placeholder="e.g. Vector Dot Product"
              value={newProgName}
              onChange={(e) => setNewProgName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Instruction Set Architecture (ISA)</label>
            <select
              className="form-select form-input-lg"
              value={newProgPreset}
              onChange={(e) => setNewProgPreset(e.target.value)}
            >
              <option value="RISC-V">RISC-V (x0..x7 registers, add, lw, sw)</option>
              <option value="MIPS">MIPS ($zero, $t0..$s1, add, lw, syscall)</option>
              <option value="x86">x86 (eax, ebx, ecx, mov, add, hlt)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="btn btn-primary"
            >
              {isCreating ? 'Creating...' : 'Create Program'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
