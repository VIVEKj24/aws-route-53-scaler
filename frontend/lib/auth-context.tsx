"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "./api";

export interface User {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const currentUser = await apiFetch<User>("/api/auth/me");
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      } else {
        setUser(null);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchUser().finally(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchUser]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      await apiFetch<{ message: string; session_id: number }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await fetchUser();
    },
    [fetchUser]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore network / logout error and continue clearing local session
    } finally {
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
