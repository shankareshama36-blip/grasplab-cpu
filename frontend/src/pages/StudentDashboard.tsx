import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Program } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { LearnTab } from './tabs/LearnTab';
import { BuildTab, SAMPLE_PROGRAMS } from './tabs/BuildTab';
import { OptimizeTab } from './tabs/OptimizeTab';
import { InstructorDashboard } from './InstructorDashboard';
import { Modal } from '../components/common/Modal';
import { Skeleton } from '../components/common/Skeleton';

export type WorkspaceTab = 'build' | 'optimize' | 'learn' | 'instructor';

const SAMPLE_PROGRAM_LIST = Object.values(SAMPLE_PROGRAMS);
const DEFAULT_STARTER_CODE = SAMPLE_PROGRAM_LIST[0].code;

export const StudentDashboard: React.FC = () => {
  const { user, logout, demoLogin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    const saved = localStorage.getItem('grasplab_workspace_tab') as WorkspaceTab | null;
    if (saved && ['build', 'optimize', 'learn', 'instructor'].includes(saved)) {
      return saved;
    }
    return user?.role === 'Instructor' ? 'instructor' : 'build';
  });

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Lifted Editor State (persists across tab switches!)
  const [sourceCode, setSourceCode] = useState<string>(DEFAULT_STARTER_CODE);
  const [preset, setPreset] = useState<string>('RISC-V');
  const [programName, setProgramName] = useState<string>('Array Sum with Branch');

  // New Program Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newProgName, setNewProgName] = useState<string>('');
  const [newProgPreset, setNewProgPreset] = useState<string>('RISC-V');
  const [newProgTemplateIdx, setNewProgTemplateIdx] = useState<number>(0);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // ISA Reference Guide Modal
  const [isISAGuideOpen, setIsISAGuideOpen] = useState<boolean>(false);
  const [isaGuideTab, setIsaGuideTab] = useState<'RISC-V' | 'MIPS' | 'x86'>('RISC-V');

  const isDirty = useMemo(() => {
    if (!selectedProgram) return false;
    return (
      sourceCode !== selectedProgram.assembly_source ||
      preset !== selectedProgram.isa_preset ||
      programName.trim() !== selectedProgram.name.trim()
    );
  }, [selectedProgram, sourceCode, preset, programName]);

  const selectProgramIntoWorkspace = (prog: Program) => {
    setSelectedProgram(prog);
    setSourceCode(prog.assembly_source);
    setPreset(prog.isa_preset || 'RISC-V');
    setProgramName(prog.name);
  };

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPrograms();
      setPrograms(data);
      if (data.length > 0 && !selectedProgram) {
        selectProgramIntoWorkspace(data[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch programs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [user?.email]);

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    localStorage.setItem('grasplab_workspace_tab', tab);
  };

  const handleSelectProgram = (prog: Program) => {
    if (isDirty && selectedProgram && selectedProgram.id !== prog.id) {
      const proceed = window.confirm(
        `You have unsaved edits in "${selectedProgram.name}". Discard changes and switch to "${prog.name}"?`
      );
      if (!proceed) return;
    }
    selectProgramIntoWorkspace(prog);
    if (activeTab === 'learn' || activeTab === 'instructor') {
      handleTabChange('build');
    }
  };

  const handleEnterScratchpad = () => {
    setSelectedProgram(null);
    setProgramName('Scratchpad Program');
    handleTabChange('build');
    showToast('Switched to Scratchpad mode. You can simulate freely or save as a new program anytime.', 'info');
  };

  const handleSaveCurrentProgram = async () => {
    if (!selectedProgram) {
      await handleSaveAsNewProgram();
      return;
    }
    try {
      const updated = await api.updateProgram(selectedProgram.id, {
        name: programName.trim() || selectedProgram.name,
        assembly_source: sourceCode,
        isa_preset: preset,
      });
      setSelectedProgram(updated);
      setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(`Saved "${updated.name}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save program', 'error');
    }
  };

  const handleSaveAsNewProgram = async (customName?: string, customSource?: string, customPreset?: string) => {
    const targetName = (customName ?? programName).trim() || 'Untitled Program';
    const targetSource = customSource ?? sourceCode;
    const targetPreset = customPreset ?? preset;
    try {
      const created = await api.createProgram(targetName, targetSource, targetPreset);
      setPrograms((prev) => [created, ...prev]);
      selectProgramIntoWorkspace(created);
      showToast(`Program "${created.name}" saved to workspace!`, 'success');
      handleTabChange('build');
    } catch (err: any) {
      showToast(err.message || 'Could not save new program', 'error');
    }
  };

  const handleDuplicateProgram = async (prog: Program, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const created = await api.createProgram(
        `${prog.name} (Copy)`,
        prog.assembly_source,
        prog.isa_preset
      );
      setPrograms((prev) => [created, ...prev]);
      selectProgramIntoWorkspace(created);
      showToast(`Duplicated "${prog.name}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to duplicate program', 'error');
    }
  };

  const handleCreateProgramModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName.trim()) return;

    setIsCreating(true);
    const chosenTemplate = SAMPLE_PROGRAM_LIST[newProgTemplateIdx];
    const starterCode = chosenTemplate
      ? chosenTemplate.code
      : newProgPreset === 'x86'
      ? 'mov eax, 5\nmov ebx, 10\nadd eax, ebx\nhlt'
      : 'LOAD R1, 5\nLOAD R2, 10\nADD R3, R1, R2\nHALT';

    try {
      const created = await api.createProgram(newProgName.trim(), starterCode, newProgPreset);
      setPrograms((prev) => [created, ...prev]);
      selectProgramIntoWorkspace(created);
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

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    try {
      const seeded = await api.seedSamplePrograms();
      setPrograms(seeded);
      if (seeded.length > 0 && !selectedProgram) {
        selectProgramIntoWorkspace(seeded[0]);
      }
      showToast('Starter benchmark programs loaded into your workspace!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to seed starter programs', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteProgram = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = programs.find((p) => p.id === id);
    if (!window.confirm(`Delete program "${target?.name || id}"?`)) return;
    try {
      await api.deleteProgram(id);
      const remaining = programs.filter((p) => p.id !== id);
      setPrograms(remaining);
      if (selectedProgram?.id === id) {
        if (remaining.length > 0) {
          selectProgramIntoWorkspace(remaining[0]);
        } else {
          setSelectedProgram(null);
        }
      }
      showToast('Program deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete program', 'error');
    }
  };

  const handleQuickRoleSwitch = async () => {
    const targetRole = user?.role === 'Instructor' ? 'Student' : 'Instructor';
    await demoLogin(targetRole);
    handleTabChange(targetRole === 'Instructor' ? 'instructor' : 'build');
  };

  const filteredPrograms = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) => p.name.toLowerCase().includes(q) || p.isa_preset.toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'S';
  const userName = user?.email ? user.email.split('@')[0] : 'Student';

  const activeTabLabel: Record<WorkspaceTab, string> = {
    build: 'CPU Simulator',
    optimize: 'Pipeline & Hazard Lab',
    learn: 'Interactive Concept Labs',
    instructor: 'Classroom Analytics',
  };

  return (
    <div className="workspace-shell">
      {/* Top Navbar with Breadcrumbs, Central Workspace Switcher & Quick Utilities */}
      <header className="workspace-topbar">
        {/* Left: Sidebar Toggle, Brand & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="btn btn-secondary btn-sm"
            title={sidebarOpen ? 'Collapse Project Explorer' : 'Expand Project Explorer'}
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
          >
            {sidebarOpen ? '◀' : '☰'}
          </button>

          <div
            onClick={() => handleTabChange('build')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              fontWeight: 800,
              fontSize: '1.15rem',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                fontSize: '0.95rem',
              }}
            >
              ⚡
            </div>
            <span>GraspLab</span>
          </div>

          <div className="workspace-breadcrumb">
            <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>
              {user?.tenant_id || 'workspace'}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>/</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
              {activeTabLabel[activeTab]}
            </span>
            {(activeTab === 'build' || activeTab === 'optimize') && (
              <>
                <span style={{ color: 'var(--text-dim)' }}>/</span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedProgram ? selectedProgram.name : 'Scratchpad'}
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                  {preset}
                </span>
                {isDirty && (
                  <span
                    className="badge badge-amber"
                    style={{ fontSize: '0.65rem' }}
                    title="You have unsaved edits in the simulator"
                  >
                    ● Unsaved
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center: Primary Navigation Tabs */}
        <div className="nav-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'build'}
            className={`nav-tab-btn ${activeTab === 'build' ? 'active' : ''}`}
            onClick={() => handleTabChange('build')}
          >
            <span>🛠️</span> Simulator
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'optimize'}
            className={`nav-tab-btn ${activeTab === 'optimize' ? 'active' : ''}`}
            onClick={() => handleTabChange('optimize')}
          >
            <span>🚀</span> Pipeline & Hazards
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'learn'}
            className={`nav-tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
            onClick={() => handleTabChange('learn')}
          >
            <span>📘</span> Concept Labs
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'instructor'}
            className={`nav-tab-btn ${activeTab === 'instructor' ? 'active' : ''}`}
            onClick={() => handleTabChange('instructor')}
          >
            <span>🎓</span> Analytics
          </button>
        </div>

        {/* Right: ISA Guide, Demo Role Switcher & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={() => {
              setIsaGuideTab((preset as any) || 'RISC-V');
              setIsISAGuideOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            title="Open ISA Register & Instruction Reference"
          >
            📖 ISA Guide
          </button>

          <button
            onClick={handleQuickRoleSwitch}
            className={user?.role === 'Instructor' ? 'btn btn-demo-primary btn-sm' : 'btn btn-demo-instructor btn-sm'}
            title="Switch between Student and Instructor demo accounts"
          >
            {user?.role === 'Instructor' ? '👨‍🎓 Student View' : '🎓 Instructor View'}
          </button>

          <div className="user-avatar-pill">
            <div className="user-avatar-circle" title={user?.email}>
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {userName}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {user?.role || 'Student'}
              </span>
            </div>
          </div>

          <button onClick={logout} className="btn btn-secondary btn-sm" title="Sign out of GraspLab">
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Body: Collapsible Left Explorer Sidebar + Active Workspace Content */}
      <div className="workspace-body">
        {sidebarOpen && (
          <aside className="workspace-sidebar fade-in">
            {/* Explorer Header & Actions */}
            <div style={{ padding: '1rem 1rem 0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Workspace Programs ({programs.length})
                </span>
                <button
                  onClick={() => {
                    setNewProgPreset(preset);
                    setIsModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.22rem 0.55rem', fontSize: '0.72rem' }}
                >
                  + New
                </button>
              </div>

              <input
                type="text"
                className="form-input"
                placeholder="Filter saved programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
              />
            </div>

            {/* Saved Programs List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
              {/* Scratchpad Mode Item */}
              <div
                onClick={handleEnterScratchpad}
                className={`sidebar-program-item ${selectedProgram === null ? 'active' : ''}`}
                style={{ marginBottom: '0.4rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                  <span>⚡</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Live Scratchpad
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      Simulate without saving
                    </div>
                  </div>
                </div>
                <span className="badge badge-cyan" style={{ fontSize: '0.62rem' }}>
                  {preset}
                </span>
              </div>

              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <Skeleton width="100%" height="44px" borderRadius="8px" />
                  <Skeleton width="100%" height="44px" borderRadius="8px" />
                  <Skeleton width="100%" height="44px" borderRadius="8px" />
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div
                  style={{
                    padding: '1rem 0.75rem',
                    textAlign: 'center',
                    border: '1px dashed var(--border)',
                    borderRadius: '8px',
                    marginTop: '0.4rem',
                  }}
                >
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                    {programs.length === 0
                      ? 'No saved programs in this workspace yet.'
                      : 'No programs match your filter.'}
                  </p>
                  {programs.length === 0 && (
                    <button
                      onClick={handleSeedSamples}
                      disabled={isSeeding}
                      className="btn btn-accent btn-sm"
                      style={{ width: '100%', fontSize: '0.75rem' }}
                    >
                      {isSeeding ? 'Loading Pack...' : '📦 Load 4 Starter Programs'}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {filteredPrograms.map((prog) => {
                    const isSelected = selectedProgram?.id === prog.id;
                    return (
                      <div
                        key={prog.id}
                        onClick={() => handleSelectProgram(prog)}
                        className={`sidebar-program-item ${isSelected ? 'active' : ''}`}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#ffffff' : 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span>📄</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{prog.name}</span>
                            {isSelected && isDirty && (
                              <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem' }} title="Unsaved changes">
                                ●
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                            <span
                              className={`badge ${
                                prog.isa_preset === 'RISC-V'
                                  ? 'badge-blue'
                                  : prog.isa_preset === 'MIPS'
                                  ? 'badge-cyan'
                                  : 'badge-amber'
                              }`}
                              style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}
                            >
                              {prog.isa_preset}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                              {prog.assembly_source.split('\n').filter((l) => l.trim()).length} lines
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <button
                            onClick={(e) => handleDuplicateProgram(prog, e)}
                            className="sidebar-icon-btn"
                            title="Duplicate program"
                          >
                            ⧉
                          </button>
                          <button
                            onClick={(e) => handleDeleteProgram(prog.id, e)}
                            className="sidebar-icon-btn danger"
                            title="Delete program"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Built-in Starter Templates Section */}
              <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                    Quick Templates
                  </span>
                  <button
                    onClick={handleSeedSamples}
                    disabled={isSeeding}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a5b4fc',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title="Ensure all 4 starter programs are saved to DB"
                  >
                    {isSeeding ? 'Seeding...' : '+ Seed DB'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {SAMPLE_PROGRAM_LIST.map((tpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSourceCode(tpl.code);
                        setPreset(tpl.preset);
                        if (!selectedProgram) {
                          setProgramName(tpl.name);
                        }
                        handleTabChange('build');
                        showToast(`Loaded "${tpl.name}" (${tpl.preset}) into editor`, 'info');
                      }}
                      className="sidebar-template-btn"
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ⚡ {tpl.name}
                      </span>
                      <span className="badge badge-blue" style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem' }}>
                        {tpl.preset}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Footer: Save Status & Quick Help */}
            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderTop: '1px solid var(--border)',
                background: 'rgba(9, 9, 11, 0.5)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              {isDirty ? (
                <button
                  onClick={handleSaveCurrentProgram}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', fontSize: '0.76rem' }}
                >
                  💾 Save Changes to "{selectedProgram?.name}"
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Workspace State:</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    {selectedProgram ? '✓ Synced' : 'Scratchpad'}
                  </span>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Active Workspace Main Content */}
        <main className="workspace-content">
          {activeTab === 'build' && (
            <BuildTab
              currentProgram={selectedProgram}
              sourceCode={sourceCode}
              setSourceCode={setSourceCode}
              preset={preset}
              setPreset={setPreset}
              programName={programName}
              setProgramName={setProgramName}
              isDirty={isDirty}
              onSaveProgram={handleSaveCurrentProgram}
              onSaveAsNewProgram={handleSaveAsNewProgram}
              onOpenISAGuide={() => {
                setIsaGuideTab((preset as any) || 'RISC-V');
                setIsISAGuideOpen(true);
              }}
              onJumpToOptimize={() => handleTabChange('optimize')}
            />
          )}

          {activeTab === 'optimize' && (
            <OptimizeTab
              currentProgram={selectedProgram}
              sourceCode={sourceCode}
              preset={preset}
              programName={selectedProgram ? selectedProgram.name : programName}
              onBackToEditor={() => handleTabChange('build')}
            />
          )}

          {activeTab === 'learn' && <LearnTab />}

          {activeTab === 'instructor' && (
            <InstructorDashboard
              embedded={true}
              onOpenProgramInSimulator={(prog) => {
                selectProgramIntoWorkspace(prog);
                handleTabChange('build');
                showToast(`Opened "${prog.name}" in CPU Simulator`, 'success');
              }}
            />
          )}
        </main>
      </div>

      {/* Create New Program Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Assembly Program">
        <form onSubmit={handleCreateProgramModal}>
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
              <option value="RISC-V">RISC-V (x0..x7 / R0..R7, add, lw, sw, beq)</option>
              <option value="MIPS">MIPS ($zero, $t0..$s1, add, lw, sw, bne)</option>
              <option value="x86">x86 (eax..esp, mov, add, cmp, jnz, hlt)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Starter Code Template</label>
            <select
              className="form-select"
              value={newProgTemplateIdx}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                setNewProgTemplateIdx(idx);
                if (SAMPLE_PROGRAM_LIST[idx]) {
                  setNewProgPreset(SAMPLE_PROGRAM_LIST[idx].preset);
                }
              }}
            >
              {SAMPLE_PROGRAM_LIST.map((tpl, i) => (
                <option key={i} value={i}>
                  {tpl.name} ({tpl.preset}) — {tpl.desc}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isCreating} className="btn btn-primary">
              {isCreating ? 'Creating...' : 'Create Program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Interactive ISA Syntax & Register Guide Modal */}
      <Modal
        isOpen={isISAGuideOpen}
        onClose={() => setIsISAGuideOpen(false)}
        title="📖 GraspLab ISA Syntax & Instruction Reference"
        maxWidth="760px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="nav-tabs">
              {(['RISC-V', 'MIPS', 'x86'] as const).map((arch) => (
                <button
                  key={arch}
                  type="button"
                  onClick={() => setIsaGuideTab(arch)}
                  className={`nav-tab-btn ${isaGuideTab === arch ? 'active' : ''}`}
                  style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                >
                  {arch}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const match = SAMPLE_PROGRAM_LIST.find((s) => s.preset === isaGuideTab) || SAMPLE_PROGRAM_LIST[0];
                setSourceCode(match.code);
                setPreset(match.preset);
                setIsISAGuideOpen(false);
                handleTabChange('build');
                showToast(`Inserted ${isaGuideTab} sample program into editor`, 'success');
              }}
              className="btn btn-accent btn-sm"
            >
              ⚡ Load {isaGuideTab} Example into Editor
            </button>
          </div>

          {/* Register Map */}
          <div
            style={{
              padding: '0.9rem 1rem',
              background: 'rgba(9, 9, 11, 0.6)',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {isaGuideTab} Register Aliases (8 Architectural Registers + Flags)
            </div>
            {isaGuideTab === 'RISC-V' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                <code>x0..x7</code> or universal <code>R0..R7</code> • Also supports ABI names: <code>zero (x0)</code>, <code>ra (x1)</code>, <code>sp (x2)</code>, <code>t0..t2 (x5..x7)</code>, <code>a0..a1</code>
              </div>
            )}
            {isaGuideTab === 'MIPS' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                <code>$zero</code>, <code>$t0..$t4</code>, <code>$s0..$s1</code> (or universal <code>R0..R7</code>)
              </div>
            )}
            {isaGuideTab === 'x86' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                <code>eax</code>, <code>ebx</code>, <code>ecx</code>, <code>edx</code>, <code>esi</code>, <code>edi</code>, <code>ebp</code>, <code>esp</code> (or universal <code>R0..R7</code>)
              </div>
            )}
          </div>

          {/* Instruction Categories Table */}
          <div className="table-container">
            <table className="data-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Mnemonics</th>
                  <th>Example Syntax</th>
                  <th>Behavior</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: '#a5b4fc' }}>Data Movement</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>LOAD, STORE, MOV, LW, SW, LI</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {isaGuideTab === 'x86'
                      ? 'mov eax, 42\nmov [200], eax'
                      : isaGuideTab === 'MIPS'
                      ? 'li $t0, 42\nlw $t1, 0($t0)'
                      : 'LOAD R1, 42\nSTORE R1, [100]'}
                  </td>
                  <td>Load immediate/memory `[addr]` or store register to RAM `[0..255]`</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#34d399' }}>Arithmetic</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>ADD, SUB, MUL, INC, DEC</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {isaGuideTab === 'x86'
                      ? 'add eax, ebx\nsub eax, 1'
                      : isaGuideTab === 'MIPS'
                      ? 'addi $t0, $t0, 5\nmul $s0, $t0, $t1'
                      : 'ADD R3, R1, R2\nSUB R1, R1, 1'}
                  </td>
                  <td>Updates destination register and `Z` (Zero) / `N` (Negative) flags</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#67e8f9' }}>Bitwise & Shifts</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>AND, OR, XOR, NOT, SHL/SLL, SHR/SRL</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {isaGuideTab === 'x86'
                      ? 'shl eax, 2\nxor ebx, ebx'
                      : 'SHL R2, R1, 2\nAND R3, R1, 15'}
                  </td>
                  <td>Bitwise logic and arithmetic/logical bit shifting</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#fbbf24' }}>Compare & Branch</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>CMP, JMP, BEQ/JZ, BNE/BRNZ, BLT, BGT</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {isaGuideTab === 'x86'
                      ? 'cmp eax, 0\njnz loop_start'
                      : 'BEQ R1, R2, done\nBRNZ loop_start'}
                  </td>
                  <td>Supports both flag-based (`BRNZ label`) and 2-register (`BEQ R1, R2, label`) jumps</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#fb7185' }}>Control</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>NOP, HALT / HLT / SYSCALL</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {isaGuideTab === 'x86' ? 'nop\nhlt' : 'NOP\nHALT'}
                  </td>
                  <td>`NOP` inserts a pipeline bubble; `HALT` cleanly terminates execution</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
