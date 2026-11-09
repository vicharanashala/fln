import { api } from '../api';
import { useLoad } from '../hooks';

/** Which skills and subskills have approved questions, so gaps are visible before pilots start. */
export function Coverage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const data = useLoad(() => api.coverage(), 'coverage', onUnauthorized);
  if (data.loading) return <p className="muted">Loading…</p>;
  if (data.error || !data.data) return <p className="error" role="alert">{data.error}</p>;
  const skills = data.data.skills;
  const covered = skills.reduce((n, s) => n + s.subskills.filter(x => x.approved > 0).length, 0);
  const total = skills.reduce((n, s) => n + s.subskills.length, 0);
  return (
    <>
      <h1>Skill coverage</h1>
      <p className="muted">{covered} of {total} subskills have at least one approved question. {skills.filter(s => s.approved === 0).length} of {skills.length} skills have none yet.</p>
      {skills.map(s => (
        <details key={s.id} className="card" open={s.approved === 0}>
          <summary><strong>{s.id} {s.name}</strong> <span className="muted">{s.domain}</span> <span className={s.approved > 0 ? 'pill ok' : 'pill'}>{s.approved} approved</span></summary>
          <ul className="roster">
            {s.subskills.map(x => <li key={x.id}><span>{x.id} {x.name}</span><span className={x.approved > 0 ? 'pill ok' : 'pill'}>{x.approved}</span></li>)}
          </ul>
        </details>
      ))}
    </>
  );
}
