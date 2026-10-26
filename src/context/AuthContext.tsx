import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, company: string, role?: Role) => Promise<void>;
  demoLogin: (role?: Role) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  useEffect(() => {
    const storedToken = localStorage.getItem('grasplab_token');
    const storedUser = localStorage.getItem('grasplab_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Corrupt storage
        localStorage.removeItem('grasplab_user');
      }

      // Verify token with backend
      api
        .verify()
        .then((res) => {
          if (res.valid && res.user) {
            setUser(res.user);
            localStorage.setItem('grasplab_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {
          setUser(null);
          setToken(null);
          localStorage.removeItem('grasplab_token');
          localStorage.removeItem('grasplab_user');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    const handleAuthChange = () => {
      const t = localStorage.getItem('grasplab_token');
      const u = localStorage.getItem('grasplab_user');
      setToken(t);
      setUser(u ? JSON.parse(u) : null);
    };

    window.addEventListener('grasplab_auth_change', handleAuthChange);
    return () => window.removeEventListener('grasplab_auth_change', handleAuthChange);
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const res = await api.login(email, pass);
      setUser(res.user);
      setToken(res.access_token);
      showToast(`Welcome back, ${res.user.email}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  };

  const signup = async (email: string, pass: string, company: string, role: Role = 'Student') => {
    try {
      const res = await api.signup(email, pass, company, role);
      setUser(res.user);
      setToken(res.access_token);
      showToast('Account created successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Signup failed', 'error');
      throw err;
    }
  };

  const demoLogin = async (role: 'Student' | 'Instructor' = 'Student') => {
    try {
      const email = role === 'Instructor' ? 'instructor@grasplab.dev' : 'demo@grasplab.dev';
      const pass = role === 'Instructor' ? 'instructor123' : 'demo1234';
      const res = await api.login(email, pass);
      setUser(res.user);
      setToken(res.access_token);
      showToast(`Logged in as Demo ${role}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Demo login failed', 'error');
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
    showToast('Signed out.', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        signup,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
