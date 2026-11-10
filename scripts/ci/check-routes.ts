// All-routes check.
//
// scripts/ci/smoke-routes.sh only calls parameterless GET routes. This probes
// EVERY route the backend registers (GET, POST, PUT, PATCH, DELETE), discovered
// from the source so a new route is covered the day it is added, against a real
// server booted with no database (the local file store, which is what CI has).
//
// Three probes per route:
//   1. NO LOGIN       -> must answer 401 or 403, unless the route is listed in
//                        scripts/ci/public-routes.txt. This is the "someone
//                        forgot the auth check on a new route" test.
//   2. AS A TEACHER   -> must not crash (5xx) or hang.
//   3. AS SUPERADMIN  -> must not crash (5xx) or hang.
// Probes 2 and 3 send an empty JSON body and a made-up id for every :param, so
// a healthy route answers 400/403/404; a 500 or a timeout is a bug (an
// unvalidated body, a missing null check, a database call with no fallback).
//
// Also fails if the same METHOD + path is registered twice (the second one is
// silently dead).
//
// Routes that already failed when this check was introduced are listed in
// scripts/ci/routes-baseline.txt (METHOD path [phase]  # reason) so they do not
// block unrelated PRs; only a NEW problem fails. Fix one and delete its line.
//
// Usage:  npx tsx scripts/ci/check-routes.ts   (or: npm run check:routes)
//         npx tsx scripts/ci/check-routes.ts --list    # print the route inventory and exit
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.ROUTES_PORT || '3998';
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Fln@2026';
const TIMEOUT_MS = 20000;
const ID = 'probe-id-000';

// Never called while logged in as an admin: wipes the database the probe is using.
const NEVER_AS_ADMIN = new Set(['POST /api/reset']);

type Route = { method: string; path: string; file: string };

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'tests') listSourceFiles(p, out); }
    else if (/\.ts$/.test(e.name) && !/\.(test|check)\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

function discoverRoutes(): { routes: Route[]; skipped: string[] } {
  const routes: Route[] = [];
  const skipped: string[] = [];
  // app.get('/api/x', ...) and router.post('/v1/y', ...), including a path on the next line.
  const re = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*(['"`])(\/[^'"`]*)\2/g;
  for (const f of listSourceFiles(path.join(ROOT, 'backend/src'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) {
      const p = m[3];
      if (p.includes('${')) { skipped.push(`${m[1].toUpperCase()} ${p} (${path.relative(ROOT, f)})`); continue; }
      routes.push({ method: m[1].toUpperCase(), path: p, file: path.relative(ROOT, f) });
    }
  }
  return { routes, skipped };
}

const fill = (p: string) => p.replace(/:[A-Za-z0-9_]+\??/g, ID);

async function call(method: string, p: string, token?: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const init: RequestInit = { method, headers, signal: ctrl.signal };
    if (method !== 'GET' && method !== 'DELETE') { headers['Content-Type'] = 'application/json'; init.body = '{}'; }
    const res = await fetch(BASE + fill(p), init);
    await res.arrayBuffer().catch(() => undefined);
    return String(res.status);
  } catch (e: any) {
    return e?.name === 'AbortError' ? 'HANG' : 'ERR';
  } finally { clearTimeout(t); }
}

async function main() {
  const { routes, skipped } = discoverRoutes();

  // duplicates
  const seen = new Map<string, Route>();
  const dupes: string[] = [];
  for (const r of routes) {
    const k = `${r.method} ${r.path}`;
    if (seen.has(k)) dupes.push(`${k}  (${seen.get(k)!.file} and ${r.file})`); else seen.set(k, r);
  }
  const unique = [...seen.values()].sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));

  if (process.argv.includes('--list')) {
    unique.forEach(r => console.log(`${r.method.padEnd(6)} ${r.path}   ${r.file}`));
    console.log(`\n${unique.length} routes (${skipped.length} with a template-literal path not probed)`);
    return;
  }

  const readList = (f: string) => fs.existsSync(path.join(ROOT, f))
    ? fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean) : [];
  const publicRoutes = new Set(readList('scripts/ci/public-routes.txt').map(l => l.replace(/\s+/g, ' ')));
  const baseline = new Set(readList('scripts/ci/routes-baseline.txt').map(l => l.replace(/\s+/g, ' ')));

  // ---- boot the real server on a fresh file store
  const DB = path.join(ROOT, 'backend/data/db.json');
  const STASH = DB + '.routes-backup';
  if (fs.existsSync(DB)) fs.renameSync(DB, STASH);
  let log = '';
  const env: NodeJS.ProcessEnv = { ...process.env, PORT, NODE_ENV: 'development' };
  delete env.MONGODB_URI;
  const server: ChildProcess = spawn('npx', ['tsx', 'src/index.ts'], { cwd: path.join(ROOT, 'backend'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.on('data', d => { log += d; });
  server.stderr?.on('data', d => { log += d; });
  const cleanup = () => {
    try { server.kill(); } catch { /* already gone */ }
    try { fs.rmSync(DB, { force: true }); if (fs.existsSync(STASH)) fs.renameSync(STASH, DB); } catch { /* best effort */ }
  };
  process.on('exit', cleanup);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  let up = false;
  for (let i = 0; i < 120; i++) { if (log.includes('Server running on')) { up = true; break; } await sleep(1000); }
  if (!up) { console.error('Server did not start within 120s. Log tail:\n' + log.split('\n').slice(-30).join('\n')); process.exit(1); }

  const login = async (email: string): Promise<string> => {
    for (let i = 0; i < 30; i++) {
      try {
        const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
        const j: any = await r.json().catch(() => ({}));
        if (j.token) return j.token;
      } catch { /* not ready */ }
      await sleep(2000);
    }
    return '';
  };
  const SUPER = await login('superadmin@fln.org');
  let TEACHER = await login('gps-mt-001.t01@fln.org');
  if (!TEACHER) TEACHER = await login('teacher.ap_gnt_gnt_01_01.c2@fln.org');
  if (!SUPER || !TEACHER) {
    console.error(`Login failed (superadmin ${SUPER ? 'ok' : 'FAILED'}, teacher ${TEACHER ? 'ok' : 'FAILED'}) — the seed or auth is broken.\n` + log.split('\n').slice(-20).join('\n'));
    process.exit(1);
  }
  console.log(`server up; probing ${unique.length} routes (${unique.filter(r => r.path.startsWith('/api')).length} /api, ${unique.filter(r => !r.path.startsWith('/api')).length} other) with no login, as a teacher and as a superadmin`);

  // ---- probe
  type Finding = { key: string; why: string };
  const findings: Finding[] = [];
  const counts = { unprotected: 0, crash: 0, probes: 0 };
  for (const r of unique) {
    const id = `${r.method} ${r.path}`;
    // 1. no login
    const anon = await call(r.method, r.path); counts.probes++;
    if (anon === 'HANG' || anon === 'ERR' || anon.startsWith('5')) {
      findings.push({ key: `${id} anon`, why: `no login -> ${anon} (a route must refuse a missing login cleanly, not crash)` });
    } else if (!publicRoutes.has(id) && anon !== '401' && anon !== '403' && anon !== '429') {
      findings.push({ key: `${id} anon`, why: `no login -> ${anon}. Expected 401/403. Either the route has no auth check, or it is public — add it to scripts/ci/public-routes.txt` });
    }
    if (!r.path.startsWith('/api')) continue; // vault /v1 routes use scoped service tokens, not user logins
    // 2 + 3. logged in
    for (const [who, tok] of [['teacher', TEACHER], ['superadmin', SUPER]] as const) {
      if (who === 'superadmin' && NEVER_AS_ADMIN.has(id)) continue;
      const code = await call(r.method, r.path, tok); counts.probes++;
      if (code === 'HANG' || code === 'ERR' || code.startsWith('5')) findings.push({ key: `${id} ${who}`, why: `as ${who} -> ${code}` });
    }
  }

  const live = new Set(findings.map(f => f.key));
  const fresh = findings.filter(f => !baseline.has(f.key));
  const fixed = [...baseline].filter(k => !live.has(k));
  const freshDupes = dupes.filter(d => !baseline.has(`DUP ${d.split('  ')[0]}`));

  console.log(`\nroutes probed: ${unique.length} | requests: ${counts.probes} | findings: ${findings.length} (${findings.length - fresh.length} already in the baseline, ${fresh.length} new)`);
  if (skipped.length) console.log(`not probed (template-literal path): ${skipped.length}`);
  if (fixed.length) {
    console.log(`\n${fixed.length} baseline line(s) now pass — delete them from scripts/ci/routes-baseline.txt:`);
    fixed.forEach(k => console.log(`  ${k}`));
  }
  const bad = [...fresh.map(f => `${f.key.split(' ')[0]} ${f.key.split(' ')[1]}  [${f.key.split(' ')[2]}]  ${f.why}`),
    ...freshDupes.map(d => `route registered twice: ${d}`)];
  cleanup();
  if (bad.length) {
    console.error(`\nFAILED — ${bad.length} problem(s):`);
    bad.forEach(b => console.error(`  - ${b}`));
    process.exit(1);
  }
  console.log('OK');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
