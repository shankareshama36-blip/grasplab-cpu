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
    <div className="auth-page-container">
      {/* Animated Glowing Mesh Gradient */}
      <div className="auth-mesh-bg" aria-hidden="true">
        <div className="auth-mesh-orb-1" />
        <div className="auth-mesh-orb-2" />
        <div className="auth-mesh-orb-3" />
        <div className="auth-grid-overlay" />
      </div>

      {/* Centered Floating Glass Card */}
      <div
        className="glass-panel fade-in"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '470px',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.15)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
              marginBottom: '1rem',
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)',
              fontSize: '1.65rem',
            }}
          >
            ⚡
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              GraspLab
            </h1>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '0.15rem 0.45rem',
                borderRadius: '9999px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                textTransform: 'uppercase',
              }}
            >
              Enterprise
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Interactive Computer Architecture & Pipelining Lab
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

        {/* 1-Click Demo Login - Popped Out Secondary Action */}
        <div
          style={{
            background: 'rgba(24, 24, 27, 0.65)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#a5b4fc',
              marginBottom: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>✨</span> Instant Evaluation Access
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => handleDemoClick('Student')}
              disabled={isDemoSubmitting || isSubmitting}
              className="btn btn-demo-primary"
              style={{
                padding: '0.65rem 0.75rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              {isDemoSubmitting ? 'Authenticating...' : '🚀 Student Demo'}
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('Instructor')}
              disabled={isDemoSubmitting || isSubmitting}
              className="btn btn-demo-instructor"
              style={{
                padding: '0.65rem 0.75rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              {isDemoSubmitting ? 'Authenticating...' : '🎓 Instructor Portal'}
            </button>
          </div>

          {/* Demo Credentials Pill */}
          <div
            style={{
              marginTop: '0.75rem',
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              paddingTop: '0.5rem',
            }}
          >
            <span>Student: demo@grasplab.dev</span>
            <span>Pass: demo1234</span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            textAlign: 'center',
            margin: '1.25rem 0',
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ padding: '0 0.75rem' }}>or sign in with credentials</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Email/Password Form with Larger Inputs & Clear Focus Rings */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              className="form-input form-input-lg"
              placeholder="e.g. demo@grasplab.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
            </div>
            <input
              type="password"
              required
              className="form-input form-input-lg"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isDemoSubmitting}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        {/* Bottom Switch Link */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToSignup}
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
            Create Organization Account →
          </button>
        </div>
      </div>
    </div>
  );
};
