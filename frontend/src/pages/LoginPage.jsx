import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLES } from "../data/roles";

export default function LoginPage() {
  const { login, loading, error, setError } = useAuth();
  const navigate = useNavigate();

  const [activeRole, setActiveRole] = useState(ROLES[0].key);
  const [email, setEmail] = useState(ROLES[0].email);
  const [password, setPassword] = useState("");

  function selectRole(key) {
    setActiveRole(key);
    const r = ROLES.find((x) => x.key === key);
    if (r?.email) setEmail(r.email);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      const path = await login(email, password, activeRole);
      navigate(path, { replace: true });
    } catch {
      /* error displayed via context */
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-slate-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white grid place-items-center mb-3 shadow">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to the FLN platform</p>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => selectRole(r.key)}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition ${
                activeRole === r.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <div className="mt-1 relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Password</label>
            <div className="mt-1 relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition shadow-sm"
          >
            {loading ? "Signing in…" : `Sign in as ${ROLES.find((r) => r.key === activeRole)?.label}`}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6">
          Default superadmin: superadmin@fln.org / Welcome1!
        </p>
      </div>
    </div>
  );
}