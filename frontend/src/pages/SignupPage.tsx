import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface SignupPageProps {
  onNavigateToLogin: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigateToLogin }) => {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<Role>('Student');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError('Company or University Name is required for tenant isolation');
      return;
    }
    setIsSubmitting(true);
    try {
      await signup(email, password, companyName.trim(), role);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Animated Glowing Mesh Gradient */}
      <div className="auth-mesh-bg" aria-hidden="true">
        <div className="auth-mesh-orb-1" />
        <div className="auth-mesh-orb-2" />
        <div className="auth-mesh-orb-3" />
        <div className="auth-grid-overlay" />
      </div>

      {/* Floating Glass Card */}
      <div
        className="glass-panel fade-in"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '480px',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #10b981 100%)',
              marginBottom: '1rem',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.35)',
              fontSize: '1.5rem',
            }}
          >
            🏢
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Join GraspLab
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Set up an isolated multi-tenant workspace for your organization
          </p>
        </div>

        {error && (
          <div
            className="fade-in"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid var(--accent-rose)',
              color: '#fda4af',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Organization / University Name <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              type="text"
              required
              className="form-input form-input-lg"
              placeholder="e.g. Stanford University or Acme Robotics"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              Used to establish strict tenant data boundaries.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Role</label>
            <select
              className="form-select form-input-lg"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="Student">Student (Learn, Build, Optimize)</option>
              <option value="Instructor">Instructor (Classroom Monitoring & Diagnostics)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              className="form-input form-input-lg"
              placeholder="you@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="form-input form-input-lg"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            {isSubmitting ? 'Provisioning Workspace...' : 'Create Organization Workspace'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: '#818cf8',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
              fontFamily: 'var(--font-sans)',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#a5b4fc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#818cf8')}
          >
            Sign In →
          </button>
        </div>
      </div>
    </div>
  );
};
