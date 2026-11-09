import { useState, type FormEvent } from 'react';
import { api, saveToken } from '../api';

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.login(email.trim(), password);
      if (r.user.role !== 'teacher') { setError('This version is for teachers. Please use a teacher account.'); return; }
      saveToken(r.token);
      onLoggedIn();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not log in.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="narrow">
      <h1>FLN for teachers</h1>
      <p className="muted">Log in to see your classes.</p>
      <form className="card" onSubmit={submit}>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </main>
  );
}
