import assert from 'node:assert';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config';

const secret = 'k'.repeat(40);

describe('config', () => {
  it('needs only a strong secret and gives safe small-server defaults', () => {
    const c = loadConfig({ JWT_SECRET: secret });
    assert.equal(c.port, 3100);
    assert.equal(c.mongo.db, 'fln_v2');
    assert.equal(c.mongo.maxPoolSize, 10);
    assert.deepEqual(c.limits, { jsonBodyMb: 1, scanBodyMb: 9, loginPer15Min: 20, scanPerHour: 120 });
    assert.equal(c.ollama, undefined, 'photo reading is off until a model is set');
    assert.equal(c.mongo.uri, undefined);
  });
  it('refuses a missing or short secret, naming the setting', () => {
    for (const env of [{}, { JWT_SECRET: 'short' }, { JWT_SECRET: '' }]) assert.throws(() => loadConfig(env), /JWT_SECRET/);
  });
  it('reports every bad number at once and never accepts junk, fractions or out-of-range values', () => {
    try {
      loadConfig({ JWT_SECRET: secret, PORT: '99999', MONGODB_MAX_POOL: '0', SCAN_BODY_MB: 'big', LOGIN_PER_15_MIN: '2.5', OLLAMA_MODEL: 'm', OLLAMA_CONCURRENT: '50' });
      assert.fail('should have thrown');
    } catch (err) {
      const m = (err as Error).message;
      for (const name of ['PORT', 'MONGODB_MAX_POOL', 'SCAN_BODY_MB', 'LOGIN_PER_15_MIN', 'OLLAMA_CONCURRENT']) assert.match(m, new RegExp(name), name);
    }
  });
  it('turns photo reading on with one reader at a time by default', () => {
    const c = loadConfig({ JWT_SECRET: secret, OLLAMA_MODEL: 'gemma4:cloud', OLLAMA_API_KEY: 'k' });
    assert.deepEqual(c.ollama, { host: 'https://ollama.com', apiKey: 'k', model: 'gemma4:cloud', timeoutMs: 60000, concurrent: 1, queue: 10 });
  });
  it('reads overrides', () => {
    const c = loadConfig({ JWT_SECRET: secret, PORT: '4100', MONGODB_URI: 'mongodb://x', MONGODB_DB: 'd', SCAN_PER_HOUR: '30', APP_VERSION: 'abc123' });
    assert.equal(c.port, 4100); assert.equal(c.mongo.uri, 'mongodb://x'); assert.equal(c.mongo.db, 'd'); assert.equal(c.limits.scanPerHour, 30); assert.equal(c.version, 'abc123');
  });
});
