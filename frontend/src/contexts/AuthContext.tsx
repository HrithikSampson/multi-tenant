import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types';
import { authAPI } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedOrganizationId = localStorage.getItem('organizationId');
    
    if (storedToken) {
      setToken(storedToken);
      if (storedOrganizationId) {
        setOrganizationId(storedOrganizationId);
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.login(username, password);
      const { accessToken, user: userData } = response;
      
      setToken(accessToken);
      setUser(userData);
      localStorage.setItem('token', accessToken);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setOrganizationId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('organizationId');
  };

  const setOrganization = (orgId: string) => {
    setOrganizationId(orgId);
    localStorage.setItem('organizationId', orgId);
  };

  const isAuthenticated = !!token && !!user;

  const value: AuthContextType = {
    user,
    token,
    organizationId,
    login,
    logout,
    setOrganization,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
