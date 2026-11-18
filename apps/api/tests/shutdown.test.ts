import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { it } from 'node:test';

// systemd stops the service with SIGTERM and waits for it to exit. A process that ignores it is killed after the stop timeout (about 90 seconds),
// which made every restart slow once a SIGTERM handler was added for the QR worker (#904).
it('the server exits promptly when it is told to stop', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: { ...process.env, PORT: '3187', JWT_SECRET: 'x'.repeat(40), MONGODB_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  for (let i = 0; i < 100 && !out.includes('listening'); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(out.includes('listening'), `the server started: ${out.slice(0, 200)}`);
  const asked = Date.now();
  child.kill('SIGTERM');
  const result = await Promise.race([exited, new Promise<'stuck'>(r => setTimeout(() => r('stuck'), 5000))]);
  if (result === 'stuck') child.kill('SIGKILL');
  assert.notEqual(result, 'stuck', 'the server ignored SIGTERM (it had to be killed after 5 seconds)');
  assert.ok(Date.now() - asked < 3000, 'and it exited within 3 seconds');
});
