import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';

interface AuthContextType {
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (sessionId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(
    () => localStorage.getItem('admin-session-id')
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount and when sessionId changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (!sessionId) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/status', {
          headers: {
            'x-session-id': sessionId
          }
        });
        const data = await response.json();
        setIsAuthenticated(data.authenticated || false);
        
        if (!data.authenticated) {
          // Session expired, clear it
          localStorage.removeItem('admin-session-id');
          setSessionId(null);
        }
      } catch (error) {
        console.error('Auth status check failed:', error);
        setIsAuthenticated(false);
        localStorage.removeItem('admin-session-id');
        setSessionId(null);
      }
    };

    checkAuthStatus();
  }, [sessionId]);

  const login = (newSessionId: string) => {
    setSessionId(newSessionId);
    setIsAuthenticated(true);
    localStorage.setItem('admin-session-id', newSessionId);
    // Invalidate all queries to force refetch with new session
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    if (sessionId) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'x-session-id': sessionId
          }
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }
    
    setSessionId(null);
    setIsAuthenticated(false);
    localStorage.removeItem('admin-session-id');
  };

  return (
    <AuthContext.Provider value={{ sessionId, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}