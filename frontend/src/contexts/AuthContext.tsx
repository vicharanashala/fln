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

const MOCK_USER: AuthUser = {
  id: "mock-super-admin-id",
  firstName: "Super",
  lastName: "Admin",
  email: "superadmin@fln.org",
  role: "superadmin"
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(MOCK_USER);
  const [loading] = useState(false);

  useEffect(() => {
    localStorage.setItem("fln_token", "mock-token");
    localStorage.setItem("fln_user", JSON.stringify(MOCK_USER));
  }, []);

  async function login(email: string, password: string, role: string) {
    setUser(MOCK_USER);
  }

  function logout() {
    // No-op when login is disabled
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