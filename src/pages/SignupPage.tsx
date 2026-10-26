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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at top, #141f38 0%, #080b11 70%)',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem',
          border: '1px solid rgba(59, 130, 246, 0.25)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
              marginBottom: '0.75rem',
              fontSize: '1.25rem',
              fontWeight: 'bold',
            }}
          >
            🏢
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            Join GraspLab
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Set up an isolated multi-tenant workspace
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--accent-rose)',
              color: '#fda4af',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Company / University Name <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Stanford University or Acme Robotics"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
              Used to establish strict tenant data boundary.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="Student">Student (Learn, Build, Optimize)</option>
              <option value="Instructor">Instructor (Classroom Monitoring & Grading)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              className="form-input"
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
              className="form-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.75rem' }}
          >
            {isSubmitting ? 'Creating Workspace...' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
