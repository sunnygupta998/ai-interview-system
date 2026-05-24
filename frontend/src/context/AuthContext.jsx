import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../api/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ai_interview_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data.user);
        } catch (error) {
          console.error("Error loading user profile:", error);
          localStorage.removeItem('ai_interview_token');
          localStorage.removeItem('ai_interview_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authAPI.login(email, password);
      const { token: receivedToken, user: receivedUser } = res.data;
      
      localStorage.setItem('ai_interview_token', receivedToken);
      localStorage.setItem('ai_interview_user', JSON.stringify(receivedUser));
      
      setToken(receivedToken);
      setUser(receivedUser);
      return receivedUser;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role, adminSecret) => {
    setLoading(true);
    try {
      const res = await authAPI.register(name, email, password, role, adminSecret);
      if (res.data.requires_verification) {
        return res.data;
      }
      const { token: receivedToken, user: receivedUser } = res.data;
      
      localStorage.setItem('ai_interview_token', receivedToken);
      localStorage.setItem('ai_interview_user', JSON.stringify(receivedUser));
      
      setToken(receivedToken);
      setUser(receivedUser);
      return receivedUser;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyLogin = (receivedToken, receivedUser) => {
    localStorage.setItem('ai_interview_token', receivedToken);
    localStorage.setItem('ai_interview_user', JSON.stringify(receivedUser));
    setToken(receivedToken);
    setUser(receivedUser);
  };

  const logout = () => {
    localStorage.removeItem('ai_interview_token');
    localStorage.removeItem('ai_interview_user');
    setToken(null);
    setUser(null);
  };

  const googleLogin = async (googleToken, role = 'candidate') => {
    setLoading(true);
    try {
      const res = await authAPI.googleLogin(googleToken, role);
      const { token: receivedToken, user: receivedUser } = res.data;
      
      localStorage.setItem('ai_interview_token', receivedToken);
      localStorage.setItem('ai_interview_user', JSON.stringify(receivedUser));
      
      setToken(receivedToken);
      setUser(receivedUser);
      return receivedUser;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, googleLogin, verifyLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
