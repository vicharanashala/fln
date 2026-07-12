import { createContext, useContext, useEffect, useState } from "react";
import api from "../utils/api";
import { dashboardPath } from "../data/roles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("fln_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("fln_token");
    if (token && !user) {
      api.me().then(
        (r) => {
          setUser(r.user);
          localStorage.setItem("fln_user", JSON.stringify(r.user));
        },
        () => {
          localStorage.removeItem("fln_token");
          localStorage.removeItem("fln_user");
        }
      );
    }
  }, []);

  async function login(email, password, role) {
    setLoading(true);
    setError("");
    try {
      const { token, user: u } = await api.login(email, password, role);
      localStorage.setItem("fln_token", token);
      localStorage.setItem("fln_user", JSON.stringify(u));
      setUser(u);
      return dashboardPath(u.role);
    } catch (e) {
      setError(e.message || "Login failed");
      throw e;
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
    <AuthContext.Provider value={{ user, loading, error, login, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}