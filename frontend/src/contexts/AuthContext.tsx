import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (form: FormData) => Promise<void>;
  registerUser: (email: string, pass: string, name: string, role: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, token: string, pass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await api.get<UserProfile>('/auth/me');
          setUser(res.data);
          setToken(storedToken);
        } catch (e) {
          logger.error('Failed to validate credentials on load.');
          logout();
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ access_token: string; token_type: string }>('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const newToken = res.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      
      // Fetch profile details
      const profileRes = await api.get<UserProfile>('/auth/me');
      setUser(profileRes.data);
    } catch (e) {
      logout();
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const registerUser = async (email: string, pass: string, name: string, role: string) => {
    await api.post('/auth/register', {
      email,
      password: pass,
      full_name: name,
      role
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const forgotPassword = async (email: string): Promise<string> => {
    const res = await api.post<{ token: string }>('/auth/forgot-password', { email });
    return res.data.token;
  };

  const resetPassword = async (email: string, recoveryToken: string, pass: string) => {
    await api.post('/auth/reset-password', {
      email,
      token: recoveryToken,
      new_password: pass
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        registerUser,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be called inside an AuthProvider');
  }
  return context;
};

// Console logging helper
const logger = {
  error: (msg: string) => console.error(`[AuthContext] ${msg}`),
};
