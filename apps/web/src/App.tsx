import { useEffect, useState } from 'react';
import { api, hasToken, saveToken } from './api';
import { useLoad } from './hooks';
import { parseHash } from './lib';
import { ClassPage } from './screens/ClassPage';
import { Classes } from './screens/Classes';
import { Coverage } from './screens/Coverage';
import { LevelPage } from './screens/LevelPage';
import { Levels } from './screens/Levels';
import { Login } from './screens/Login';
import { Mark } from './screens/Mark';
import { People } from './screens/People';
import { PrintSheets } from './screens/PrintSheets';

export function go(path: string): void { window.location.hash = path; }

export function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [authed, setAuthed] = useState(hasToken());
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const logout = () => { saveToken(null); setAuthed(false); go('#/'); };
  if (!authed) return <Login onLoggedIn={() => { setAuthed(true); go('#/'); }} />;
  return <Shell hash={hash} logout={logout} />;
}

function Shell({ hash, logout }: { hash: string; logout: () => void }) {
  const me = useLoad(() => api.me(), 'me', logout);
  const { parts, query } = parseHash(hash);
  const isSuper = me.data?.user.role === 'superadmin';
  let screen;
  if (isSuper) {
    if (parts[0] === 'level' && parts[1]) screen = <LevelPage key={parts[1]} levelNumber={Number(parts[1])} onUnauthorized={logout} />;
    else if (parts[0] === 'people') screen = <People onUnauthorized={logout} />;
    else if (parts[0] === 'coverage') screen = <Coverage onUnauthorized={logout} />;
    else screen = <Levels onUnauthorized={logout} />;
  } else if (!me.data) screen = <p className="muted">Loading…</p>;
  else if (parts[0] === 'class' && parts[1] && parts[2] === 'print') screen = <PrintSheets key={hash} classId={parts[1]} query={query} onUnauthorized={logout} />;
  else if (parts[0] === 'class' && parts[1] && parts[2] === 'mark') screen = <Mark key={hash} classId={parts[1]} query={query} onUnauthorized={logout} />;
  else if (parts[0] === 'class' && parts[1]) screen = <ClassPage key={parts[1]} classId={parts[1]} onUnauthorized={logout} />;
  else screen = <Classes onUnauthorized={logout} />;
  return (
    <>
      <header className="top no-print">
        <a className="brand" href="#/">FLN</a>
        {isSuper && <nav className="topnav"><a href="#/levels">Levels</a><a href="#/coverage">Coverage</a><a href="#/people">People</a></nav>}
        <span className="who">{me.data?.user.name}</span>
        <button className="link" type="button" onClick={logout}>Log out</button>
      </header>
      <main>{screen}</main>
    </>
  );
}
