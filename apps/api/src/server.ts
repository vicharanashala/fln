import bcrypt from 'bcryptjs';
import { createApp } from './app';
import { loadConfig } from './config';
import { connectMongo } from './mongoRepos';
import { ollamaReader } from './ollama';
import { loadQuestionBank } from './questionBank';
import { memoryRepos, type Repos } from './repos';
import { createLimiter } from './services/limiter';

let config;
try { config = loadConfig(); } catch (err) { console.error(err instanceof Error ? err.message : err); process.exit(1); }

let repos: Repos;
let checkStore: (() => Promise<void>) | undefined;
if (config.mongo.uri) {
  // v2 uses its own database name so it can never read or write the data of main.
  const store = await connectMongo(config.mongo.uri, config.mongo.db, { maxPoolSize: config.mongo.maxPoolSize });
  await store.ensureIndexes();
  // Every curriculum level lives in the database, so questions can be written for any of them.
  console.log(`Levels in the database: ${await store.syncLevels()}`);
  repos = store.repos;
  checkStore = () => store.ping();
} else {
  console.warn('MONGODB_URI is not set: starting with an in-memory store (local demo only; data is lost on restart).');
  // A demo teacher and superadmin exist only when a password is given in the environment; nothing is hard-coded.
  const pw = config.demoPassword;
  repos = memoryRepos(pw ? {
    schools: [{ id: 'demo', name: 'Demo School' }],
    users: [
      { id: 'u_demo', email: 'demo@fln.test', name: 'Demo Teacher', role: 'teacher', schoolId: 'demo', passwordHash: bcrypt.hashSync(pw, 10) },
      { id: 'u_demo_admin', email: 'admin@fln.test', name: 'Demo Superadmin', role: 'superadmin', passwordHash: bcrypt.hashSync(pw, 10) },
    ],
  } : {});
}

// Photo reading is optional: without a model the scan route answers 503 and teachers mark by hand.
// One photo is read at a time by default and only a few may wait, so a busy class cannot swamp the free plan.
let reader;
if (config.ollama) {
  const read = ollamaReader({ host: config.ollama.host, apiKey: config.ollama.apiKey, model: config.ollama.model, timeoutMs: config.ollama.timeoutMs });
  const limit = createLimiter({ concurrent: config.ollama.concurrent, queue: config.ollama.queue });
  reader = (input: Parameters<typeof read>[0]) => limit(() => read(input));
}

createApp({
  repos, reader, checkStore, version: config.version, bank: loadQuestionBank(config.questionBankPath),
  auth: { jwtSecret: config.jwtSecret, tokenHours: config.tokenHours, bcryptCost: config.bcryptCost },
  limits: config.limits,
}).listen(config.port, '127.0.0.1', () => console.log(`FLN v2 API ${config.version} listening on 127.0.0.1:${config.port}`));
