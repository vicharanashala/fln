/**
 * Console static-plugin regression test (CORS-prevention contract).
 *
 * Why this test exists:
 *   The original CORS error
 *     "Access to fetch at 'http://localhost:4101/health' from origin 'null'
 *      has been blocked by CORS policy"
 *   was caused by opening `console/index.html` via the `file://`
 *   protocol. A `file://` page has origin `null`, and any `fetch()` to
 *   a real host (`http://localhost:4101`) is cross-origin → browser
 *   preflight → no Access-Control-Allow-Origin → blocked.
 *
 *   The fix is to serve the console from the SAME origin as the API.
 *   `@fastify/static` mounts `console/` under `/console/`, so
 *   `http://localhost:4101/console/` → index.html → fetch('/health')
 *   is a same-origin request → no preflight → no CORS headers needed.
 *
 * What this test pins down:
 *   1. `GET /console/` returns 200 and serves `index.html` (the
 *      `index: ['index.html']` plugin option).
 *   2. `GET /console/index.html`, `/console/styles.css`, and
 *      `/console/app.js` all return 200 with the expected content
 *      type. Without these, the console would render as an unstyled
 *      page with no scripts.
 *   3. `GET /console/does-not-exist` falls through to the JSON 404
 *      handler (not HTML). This proves the plugin is mounted BEFORE
 *      the route layer but that unknown paths still go through the
 *      application's `setNotFoundHandler`.
 *   4. `GET /health` still returns JSON (regression guard: the
 *      static plugin must not capture root paths).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('aadhaar-vault console (same-origin static mount)', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    app = await buildServer({
      config: {
        NODE_ENV: 'test',
        PORT: 4101,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'silent',
        KEY_PROVIDER: 'local-dev',
        LOCAL_DEV_MASTER_KEY: Buffer.alloc(32, 0x42).toString('base64'),
        KEY_VERSION: 'kv-1',
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('serves the console at /console/ (index.html resolves)', async () => {
    const res = await app!.inject({ method: 'GET', url: '/console/' });
    expect(res.statusCode).toBe(200);
    // The plugin returns the file with text/html; the document starts
    // with the HTML5 doctype declaration.
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toMatch(/^<!DOCTYPE html>/i);
    expect(res.body).toMatch(/Aadhaar Vault Console/);
  });

  it('serves /console/index.html directly', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/console/index.html',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toMatch(/Aadhaar Vault Console/);
  });

  it('serves /console/styles.css with text/css content type', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/console/styles.css',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    // Sanity: at least one CSS rule survived the round-trip.
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('serves /console/app.js with application/javascript content type', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/console/app.js',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/(application\/javascript|text\/javascript)/);
    // The script must include the IIFE wrapper we wrote.
    expect(res.body).toMatch(/aadhaar-vault-console/i);
  });

  it('serves the Step-Up console at /console/stepup.html', async () => {
    // Regression guard for the dedicated Step-Up detokenize
    // console page. The same-origin static plugin must serve
    // stepup.html + stepup.js so that operators running the
    // Request → Approve → Detokenize workflow have a UI to
    // drive it from. If a future strip accidentally removes
    // these files from the build, this test fails before any
    // operator discovers the dead link.
    const html = await app!.inject({ method: 'GET', url: '/console/stepup.html' });
    expect(html.statusCode).toBe(200);
    expect(html.headers['content-type']).toMatch(/text\/html/);
    expect(html.body).toMatch(/Step-Up Detokenize/i);
    // The page references its companion script. If a refactor
    // splits the JS into multiple bundles we want this to
    // stay a single self-contained bundle, so we pin the
    // <script src="..."> attribute to stepup.js.
    expect(html.body).toMatch(/<script src="\/console\/stepup\.js"/i);

    const js = await app!.inject({ method: 'GET', url: '/console/stepup.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toMatch(/(application\/javascript|text\/javascript)/);
    // The script body advertises its top-of-file contract so we
    // can confirm the served file is the real client, not a stub.
    expect(js.body).toMatch(/requestId/i);
    expect(js.body).toMatch(/isValidApproveResponse/i);
  });

  it('returns a JSON 404 for unknown paths under /console/', async () => {
    const res = await app!.inject({
      method: 'GET',
      url: '/console/no-such-file.html',
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body = res.json() as Record<string, unknown>;
    expect(body.error).toBe('not_found');
  });

  it('does not capture the API root: /health still returns JSON', async () => {
    // Regression guard: the static plugin is scoped to /console/. If
    // a future refactor accidentally widens its `prefix`, /health
    // would start returning HTML and the CORS-prevention contract
    // would silently break.
    const res = await app!.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body = res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });
});