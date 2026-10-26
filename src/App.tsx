import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { InstructorDashboard } from './pages/InstructorDashboard';
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
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          backgroundColor: 'var(--bg-base)',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚡</div>
        <Skeleton width="220px" height="24px" />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Loading GraspLab environment...</p>
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

  // Authenticated State Router
  if (user.role === 'Instructor') {
    return <InstructorDashboard />;
  }

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
