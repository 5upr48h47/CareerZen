import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/sso_token=([^&]+)/);
    if (match) {
      localStorage.setItem('careerzen_token', decodeURIComponent(match[1]));
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
    loadUser();
  }, []);

  async function loadUser() {
    const token = localStorage.getItem('careerzen_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data);
    } catch (err) {
      console.error('Failed to authenticate session:', err);
      localStorage.removeItem('careerzen_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(emailOrUsername, password) {
    const data = await api.login({ emailOrUsername, password });
    localStorage.setItem('careerzen_token', data.token);
    setUser(data.user);
    setAuthModalOpen(false);
    return data.user;
  }

  function startAdminSso() {
    window.location.href = api.adminSsoUrl();
  }

  async function register(formData) {
    const data = await api.register(formData);
    localStorage.setItem('careerzen_token', data.token);
    setUser(data.user);
    setAuthModalOpen(false);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('careerzen_token');
    setUser(null);
  }

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data);
    } catch (e) {
      console.error('Refresh user error:', e);
    }
  };

  async function sendOtp(phone, purpose = 'login') {
    const normalised = phone.length === 10 ? `+91${phone}` : phone;
    const data = await api.sendOtp({ phone: normalised, purpose });
    return data; // includes devOtp in dev mode
  }


  async function verifyOtp(phone, otp, purpose = 'login') {
    const normalised = phone.length === 10 ? `+91${phone}` : phone;
    const data = await api.verifyOtp({ phone: normalised, otp, purpose });
    localStorage.setItem('careerzen_token', data.token);
    setUser(data.user);
    setAuthModalOpen(false);
    return data.user;
  }

  function startAdminSso() {
    window.location.href = api.adminSsoUrl();
  }

  async function registerPhone(phone, otp, fullName, role = 'job_seeker') {
    const normalised = phone.length === 10 ? `+91${phone}` : phone;
    const data = await api.registerPhone({ phone: normalised, otp, fullName, role });
    localStorage.setItem('careerzen_token', data.token);
    setUser(data.user);
    setAuthModalOpen(false);
    return data.user;
  }

  async function googleAuth({ googleId, email, name, avatar, role = 'job_seeker' }) {
    const data = await api.googleAuth({ googleId, email, name, avatar, role });
    localStorage.setItem('careerzen_token', data.token);
    setUser(data.user);
    setAuthModalOpen(false);
    return data.user;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        logout,
        refreshUser,
        sendOtp,
        verifyOtp,
        registerPhone,
        googleAuth,
        startAdminSso,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
