import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AdminUser } from '../types';

const SESSION_EXPIRED_MESSAGE = 'আপনার সেশন শেষ হয়েছে। আবার লগইন করুন।';

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  /**
   * Non-null when the stored session turned out to be dead — the server
   * rejected the token (expired, server restarted with a new JWT secret, or
   * the account was removed/deactivated). The admin shell reads this and
   * redirects to /admin/login, passing the message along.
   */
  sessionExpired: string | null;
  /**
   * Report an authenticated API call that failed. Returns true when it was a
   * dead session (401/403 — the context cleared the session and the shell
   * will redirect to login); false for any other status so the caller can
   * show its own error.
   */
  handleAuthError: (status: number, serverMessage?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('ngo_admin_token'));
  const [user, setUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('ngo_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [sessionExpired, setSessionExpired] = useState<string | null>(null);

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem('ngo_admin_token');
    localStorage.removeItem('ngo_admin_user');
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    clearStoredSession();
  };

  const handleAuthError = useCallback(
    (status: number, serverMessage?: string): boolean => {
      if (status !== 401 && status !== 403) return false;
      setToken(null);
      setUser(null);
      clearStoredSession();
      setSessionExpired((serverMessage || '').trim() || SESSION_EXPIRED_MESSAGE);
      return true;
    },
    [clearStoredSession]
  );

  const login = (newToken: string, newUser: AdminUser) => {
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(null);
    localStorage.setItem('ngo_admin_token', newToken);
    localStorage.setItem('ngo_admin_user', JSON.stringify(newUser));
  };

  /**
   * Verify the stored token against the server as soon as we have one.
   *
   * Without this, a stale token survives silently: the dashboard still loads
   * (the list endpoints are public) and the admin only discovers the dead
   * session on the first upload, with a generic "session ended" error.
   * Verifying up front lets the shell redirect to the login page with a
   * clear message instead.
   *
   * Only a definitive 401/403 kills the session here — network errors and
   * 503s (database temporarily unreachable) keep it, since the token itself
   * may still be valid.
   */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          let message = SESSION_EXPIRED_MESSAGE;
          try {
            const body = (await res.json()) as { message?: unknown };
            if (typeof body.message === 'string' && body.message.trim()) message = body.message;
          } catch {
            /* keep the default message */
          }
          setToken(null);
          setUser(null);
          clearStoredSession();
          setSessionExpired(message);
        }
      } catch {
        /* network error — keep the session */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, clearStoredSession]);

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token, sessionExpired, handleAuthError }}
    >
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
