import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (sessionId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const storedSessionId = localStorage.getItem('admin-session-id');
    console.log('AuthProvider initializing with stored session ID:', storedSessionId);
    return storedSessionId;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount and when sessionId changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log('Checking auth status for session:', sessionId);
      if (!sessionId) {
        console.log('No session ID, setting authenticated to false');
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
        console.log('Auth status response:', data);
        setIsAuthenticated(data.authenticated || false);
        
        if (!data.authenticated) {
          // Session expired, clear it
          console.log('Session not authenticated, clearing localStorage');
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
    console.log('Login called with session ID:', newSessionId);
    
    try {
      // Force storage and verify it worked
      localStorage.setItem('admin-session-id', newSessionId);
      const storedValue = localStorage.getItem('admin-session-id');
      
      if (storedValue !== newSessionId) {
        console.error('localStorage failed to store session ID properly:', { 
          attempted: newSessionId, 
          stored: storedValue 
        });
        // Fallback: try again
        localStorage.setItem('admin-session-id', newSessionId);
      }
      
      console.log('Session ID stored in localStorage:', storedValue);
      
      // Update state
      setSessionId(newSessionId);
      setIsAuthenticated(true);
      
    } catch (error) {
      console.error('Failed to store session in localStorage:', error);
      // Still update state even if localStorage fails
      setSessionId(newSessionId);
      setIsAuthenticated(true);
    }
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