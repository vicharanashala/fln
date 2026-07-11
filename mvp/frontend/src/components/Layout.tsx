import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">FLN <span>Assessment</span></div>
        {user && (
          <div className="row">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{user.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {user.role === 'superadmin' ? 'Super Admin' : `Teacher · Class ${user.classGrade}-${user.section}`}
              </div>
            </div>
            <button className="btn secondary sm" onClick={logout}>Logout</button>
          </div>
        )}
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
