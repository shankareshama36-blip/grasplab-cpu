import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onNavigateToSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToSignup }) => {
  const { login, demoLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async (role: 'Student' | 'Instructor' = 'Student') => {
    setError(null);
    setIsDemoSubmitting(true);
    try {
      await demoLogin(role);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsDemoSubmitting(false);
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
          padding: '2.25rem',
          border: '1px solid rgba(59, 130, 246, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              marginBottom: '0.75rem',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
              fontSize: '1.5rem',
              fontWeight: 'bold',
            }}
          >
            ⚡
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            GraspLab
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Interactive Computer Architecture & Pipelining Lab
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

        {/* 1-Click Demo Logins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => handleDemoClick('Student')}
            disabled={isDemoSubmitting || isSubmitting}
            className="btn btn-accent"
            style={{
              width: '100%',
              padding: '0.7rem',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {isDemoSubmitting ? 'Authenticating...' : '🚀 1-Click Demo (Student)'}
          </button>
          <button
            type="button"
            onClick={() => handleDemoClick('Instructor')}
            disabled={isDemoSubmitting || isSubmitting}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '0.7rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              borderColor: 'var(--accent-amber)',
              color: 'var(--accent-amber)',
            }}
          >
            {isDemoSubmitting ? 'Authenticating...' : '🎓 1-Click Demo (Instructor Portal)'}
          </button>
        </div>

        {/* Demo Credentials Cheat Sheet */}
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.1rem' }}>
            Free Pre-Seeded Demo Credentials:
          </div>
          <div>👨‍🎓 <strong>Student:</strong> <code>demo@grasplab.dev</code> / <code>demo1234</code></div>
          <div>👨‍🏫 <strong>Instructor:</strong> <code>instructor@grasplab.dev</code> / <code>instructor123</code></div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            margin: '1.25rem 0',
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ padding: '0 0.75rem' }}>or sign in with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="e.g. demo@grasplab.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              required
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isDemoSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToSignup}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Create Organization Account
          </button>
        </div>
      </div>
    </div>
  );
};
