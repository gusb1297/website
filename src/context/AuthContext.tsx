import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AdminUser } from '../types';

const SESSION_EXPIRED_MESSAGE = 'আপনার সেশন শেষ হয়েছে। আবার লগইন করুন।';

const ADMIN_TOKEN_KEY = 'ngo_admin_token';
const ADMIN_USER_KEY = 'ngo_admin_user';
/** The /hackeradmin console keeps its own session, independent from /admin. */
const HACKER_TOKEN_KEY = 'ngo_hacker_token';
const HACKER_USER_KEY = 'ngo_hacker_user';

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

  /* ── /hackeradmin operations console ────────────────────────────────── */
  /** Open a console session (passcode already verified by the server). */
  hackerLogin: (token: string, user: AdminUser) => void;
  hackerLogout: () => void;
  isHackerSession: boolean;
  /** Set when the console token stopped being accepted by the server. */
  hackerSessionExpired: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(key: string): AdminUser | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as AdminUser) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => readStoredUser(ADMIN_USER_KEY));
  const [sessionExpired, setSessionExpired] = useState<string | null>(null);

  // Console (hackeradmin) session — separate storage keys, so signing into the
  // console never disturbs a normal /admin session (and vice versa).
  const [hackerToken, setHackerToken] = useState<string | null>(() => localStorage.getItem(HACKER_TOKEN_KEY));
  const [hackerUser, setHackerUser] = useState<AdminUser | null>(() => readStoredUser(HACKER_USER_KEY));
  const [hackerSessionExpired, setHackerSessionExpired] = useState<string | null>(null);

  const clearAdminSession = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  }, []);

  const clearHackerSession = useCallback(() => {
    localStorage.removeItem(HACKER_TOKEN_KEY);
    localStorage.removeItem(HACKER_USER_KEY);
  }, []);

  const logout = () => {
    setAdminToken(null);
    setAdminUser(null);
    clearAdminSession();
  };

  const hackerLogout = () => {
    setHackerToken(null);
    setHackerUser(null);
    clearHackerSession();
  };

  const handleAuthError = useCallback(
    (status: number, serverMessage?: string): boolean => {
      if (status !== 401 && status !== 403) return false;
      setAdminToken(null);
      setAdminUser(null);
      clearAdminSession();
      setSessionExpired((serverMessage || '').trim() || SESSION_EXPIRED_MESSAGE);
      return true;
    },
    [clearAdminSession]
  );

  const login = (newToken: string, newUser: AdminUser) => {
    setAdminToken(newToken);
    setAdminUser(newUser);
    setSessionExpired(null);
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(newUser));
  };

  const hackerLogin = (newToken: string, newUser: AdminUser) => {
    setHackerToken(newToken);
    setHackerUser(newUser);
    setHackerSessionExpired(null);
    localStorage.setItem(HACKER_TOKEN_KEY, newToken);
    localStorage.setItem(HACKER_USER_KEY, JSON.stringify(newUser));
  };

  /**
   * Verify a stored token against the server. Without this, a stale token
   * survives silently until the first save fails with a generic error.
   * Only a definitive 401/403 kills a session — network errors and 503s
   * (database unreachable / switched off) keep it, since the token may still
   * be perfectly valid.
   */
  const verifyToken = useCallback(
    async (token: string, kind: 'admin' | 'hacker') => {
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (res.status !== 401 && res.status !== 403) return;
        let message = SESSION_EXPIRED_MESSAGE;
        try {
          const body = (await res.json()) as { message?: unknown };
          if (typeof body.message === 'string' && body.message.trim()) message = body.message;
        } catch {
          /* keep the default message */
        }
        if (kind === 'hacker') {
          setHackerToken(null);
          setHackerUser(null);
          clearHackerSession();
          setHackerSessionExpired(message);
        } else {
          setAdminToken(null);
          setAdminUser(null);
          clearAdminSession();
          setSessionExpired(message);
        }
      } catch {
        /* network error — keep the session */
      }
    },
    [clearAdminSession, clearHackerSession]
  );

  useEffect(() => {
    if (!adminToken) return;
    let cancelled = false;
    void (async () => {
      if (!cancelled) await verifyToken(adminToken, 'admin');
    })();
    return () => {
      cancelled = true;
    };
  }, [adminToken, verifyToken]);

  useEffect(() => {
    if (!hackerToken) return;
    let cancelled = false;
    void (async () => {
      if (!cancelled) await verifyToken(hackerToken, 'hacker');
    })();
    return () => {
      cancelled = true;
    };
  }, [hackerToken, verifyToken]);

  /**
   * Which session the panels use.
   *
   * Inside /hackeradmin the console token wins — that session keeps working even
   * while MongoDB is switched off, which is exactly what the console is for.
   * Elsewhere (the public site and /admin) the ordinary admin session is used,
   * so a console login never makes the /admin panel look like it is signed in as
   * "Operations Console".
   */
  const inConsole = typeof window !== 'undefined' && window.location.pathname.startsWith('/hackeradmin');
  const token = inConsole ? hackerToken || adminToken : adminToken || hackerToken;
  const user = inConsole ? hackerUser || adminUser : adminUser || hackerUser;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        sessionExpired,
        handleAuthError,
        hackerLogin,
        hackerLogout,
        isHackerSession: !!hackerToken,
        hackerSessionExpired,
      }}
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
