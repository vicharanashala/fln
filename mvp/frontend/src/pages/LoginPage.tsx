import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: 380 }}>
        <div className="brand" style={{ fontSize: 22, marginBottom: 4 }}>FLN <span style={{ color: 'var(--brand)' }}>Assessment</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Foundational Literacy & Numeracy — Sign in</p>

        {error && <div className="alert error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@fln.org" autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="btn ghost sm" onClick={() => setShowPw((s) => !s)} style={{ position: 'absolute', right: 4, top: 4 }}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign In'}</button>
        </form>

        <div className="mt muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
          <strong>Demo accounts</strong><br />
          Super Admin: superadmin@fln.org / Admin@123<br />
          Teacher: teacher@fln.org / Teach@123
        </div>
      </div>
    </div>
  );
}
