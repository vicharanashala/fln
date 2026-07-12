import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "../services/api";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem("fln_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("fln_token");
    if (!token || user) return;
    api.get("/auth/me").then(
      (r) => {
        setUser(r.data.user);
        localStorage.setItem("fln_user", JSON.stringify(r.data.user));
      },
      () => {
        localStorage.removeItem("fln_token");
        localStorage.removeItem("fln_user");
      }
    );
  }, []);

  async function login(email: string, password: string, role: string) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password, role });
      localStorage.setItem("fln_token", data.token);
      localStorage.setItem("fln_user", JSON.stringify(data.user));
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("fln_token");
    localStorage.removeItem("fln_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}