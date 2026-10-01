import React, { createContext, useCallback, useContext, useState } from 'react';

interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const result = await window.api.auth.login(username, password);
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    return { success: false, message: result.message ?? 'Login failed' };
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
