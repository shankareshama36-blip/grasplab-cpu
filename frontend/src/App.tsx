import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { Skeleton } from './components/common/Skeleton';
import './styles/theme.css';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>(() => {
    return (localStorage.getItem('grasplab_auth_view') as any) || 'login';
  });

  const handleSwitchAuthView = (view: 'login' | 'signup') => {
    setAuthView(view);
    localStorage.setItem('grasplab_auth_view', view);
  };

  if (isLoading) {
    return (
      <div
        className="fade-in"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          backgroundColor: 'var(--bg-base)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)',
            fontSize: '1.5rem',
          }}
        >
          ⚡
        </div>
        <Skeleton width="220px" height="20px" borderRadius="6px" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading GraspLab environment...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return authView === 'login' ? (
      <LoginPage onNavigateToSignup={() => handleSwitchAuthView('signup')} />
    ) : (
      <SignupPage onNavigateToLogin={() => handleSwitchAuthView('login')} />
    );
  }

  // Unified Workspace Router (supports both Student Lab & Instructor Analytics views)
  return <StudentDashboard />;
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
