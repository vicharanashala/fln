import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useLoad } from '../hooks';

export function People({ onUnauthorized }: { onUnauthorized: () => void }) {
  const schools = useLoad(() => api.schools(), 'schools', onUnauthorized);
  const users = useLoad(() => api.users(), 'users', onUnauthorized);
  const [schoolName, setSchoolName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function addSchool(e: FormEvent) {
    e.preventDefault(); setError(null); setDone(null);
    try { await api.createSchool(schoolName); setSchoolName(''); setDone('School added.'); schools.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not add the school.'); }
  }
  async function addUser(e: FormEvent) {
    e.preventDefault(); setError(null); setDone(null);
    try {
      await api.createUser({ name, email, password, role, schoolId: role === 'superadmin' ? undefined : schoolId });
      setName(''); setEmail(''); setPassword(''); setDone('Account created. Give the person their password in person or by phone, not in a group chat.'); users.reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the account.'); }
  }
  async function toggle(id: string, isBanned: boolean) {
    setError(null);
    try { await api.setBanned(id, !isBanned); users.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not change the account.'); }
  }

  const schoolName_ = (id?: string) => schools.data?.schools.find(s => s.id === id)?.name ?? '';
  return (
    <>
      <h1>Schools and accounts</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="note" role="status">{done}</p>}

      <form className="card" onSubmit={addSchool}>
        <h2>Add a school</h2>
        <label>School name<input value={schoolName} onChange={e => setSchoolName(e.target.value)} required maxLength={120} /></label>
        <button className="primary" type="submit">Add school</button>
      </form>

      <form className="card" onSubmit={addUser}>
        <h2>Create an account</h2>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password (8 or more characters with a capital letter, a digit and a special character)<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label>Role
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="teacher">Teacher</option><option value="school">School account</option><option value="superadmin">Superadmin</option>
          </select>
        </label>
        {role !== 'superadmin' && (
          <label>School
            <select value={schoolId} onChange={e => setSchoolId(e.target.value)} required>
              <option value="">Choose a school</option>
              {schools.data?.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        <button className="primary" type="submit">Create account</button>
      </form>

      <h2>Accounts ({users.data?.users.length ?? 0})</h2>
      <ul className="roster">
        {users.data?.users.map(u => (
          <li key={u.id}>
            <span><strong>{u.name}</strong> <span className="muted">{u.email} · {u.role}{u.schoolId ? ` · ${schoolName_(u.schoolId)}` : ''}</span></span>
            <button type="button" className="link" onClick={() => void toggle(u.id, !!u.isBanned)}>{u.isBanned ? 'Unblock' : 'Block'}</button>
          </li>
        ))}
      </ul>
    </>
  );
}
