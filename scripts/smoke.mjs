// Checks that the web app and the API are really linked, on the real address.
//   node scripts/smoke.mjs https://tenali.fun
//   node scripts/smoke.mjs --api http://127.0.0.1:3100/api          (API only, e.g. on the server before nginx)
// To also test a login, set SMOKE_EMAIL and SMOKE_PASSWORD in the environment (never on the command line).
const args = process.argv.slice(2);
const apiOnly = args[0] === '--api';
const site = apiOnly ? null : (args[0] ?? '').replace(/\/+$/, '');
const api = (apiOnly ? args[1] : `${site}/v2/api/fln`)?.replace(/\/+$/, '');
if (!api) { console.error('Usage: node scripts/smoke.mjs <https://site> | --api <api base>'); process.exit(2); }

let failed = 0;
const check = async (name, fn) => {
  try { const note = await fn(); console.log(`PASS  ${name}${note ? `: ${note}` : ''}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}: ${e.message}`); }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const get = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) });

if (site) {
  let asset;
  await check('landing page', async () => { const r = await get(`${site}/v2/`); ok(r.status === 200, `status ${r.status}`); ok((await r.text()).includes('Classes 3 and below'), 'not the new landing page'); });
  await check('FLN app page', async () => {
    const r = await get(`${site}/v2/fln/`); ok(r.status === 200, `status ${r.status}`);
    const html = await r.text(); asset = /src="([^"]+\.js)"/.exec(html)?.[1]; ok(asset, 'no script in the page');
    ok(asset.startsWith('/v2/fln/'), `script path ${asset} is not under /v2/fln/`);
  });
  await check('FLN app script loads and points at the API', async () => {
    const r = await get(`${site}${asset}`); ok(r.status === 200, `status ${r.status}`);
    ok((r.headers.get('content-type') ?? '').includes('javascript'), 'not served as JavaScript');
    ok((await r.text()).includes('/v2/api/fln'), 'the app was built without the /v2/api/fln address');
  });
}
if (site) {
  let tenaliAsset;
  await check('Tenali app page', async () => {
    const r = await get(`${site}/v2/tenali/`); ok(r.status === 200, `status ${r.status}`);
    tenaliAsset = /src="(\/v2\/tenali\/assets\/[^"]+\.js)"/.exec(await r.text())?.[1]; ok(tenaliAsset, 'no script under /v2/tenali/ in the page');
  });
  await check('Tenali app script carries the /v2/tenali address', async () => {
    const r = await get(`${site}${tenaliAsset}`); ok(r.status === 200, `status ${r.status}`);
    ok((await r.text()).includes('/v2/tenali'), 'built without the /v2/tenali address');
  });
  await check('Tenali API health', async () => { const r = await get(`${site}/v2/tenali/api/health`); ok(r.status === 200, `status ${r.status}`); ok((r.headers.get('content-type') ?? '').includes('json'), 'not JSON: the request did not reach Tenali'); });
  await check('Tenali live connection (Socket.IO)', async () => { const r = await get(`${site}/v2/tenali/socket.io/?EIO=4&transport=polling`); ok(r.status === 200, `status ${r.status}`); });
  await check('Tenali code runner stays closed', async () => { const r = await get(`${site}/v2/tenali/api/playground2/run`, { method: 'POST' }); ok(r.status === 503, `status ${r.status}, expected 503`); });
}
await check('API health', async () => { const r = await get(`${api}/health`); ok(r.status === 200, `status ${r.status}`); const j = await r.json(); ok(j.ok === true, 'not ok'); return `version ${j.version}, store ${j.store}`; });
await check('API refuses a logged-out request', async () => { const r = await get(`${api}/levels`); ok(r.status === 401, `status ${r.status}, expected 401`); });
if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
  let token;
  await check('login', async () => {
    const r = await get(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD }) });
    ok(r.status === 200, `status ${r.status}`); const j = await r.json(); token = j.token; ok(token, 'no token'); return j.user.role;
  });
  if (token) {
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    await check('all 109 levels are in the database', async () => { const r = await get(`${api}/levels`, auth); ok(r.status === 200, `status ${r.status}`); const n = (await r.json()).levels.length; ok(n === 109, `${n} levels`); });
    await check('who am I', async () => { const r = await get(`${api}/auth/me`, auth); ok(r.status === 200, `status ${r.status}`); });
  }
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
