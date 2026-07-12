import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </header>
  );
}