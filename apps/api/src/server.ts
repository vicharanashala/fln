import bcrypt from 'bcryptjs';
import { createApp } from './app';
import { connectMongo } from './mongoRepos';
import { ollamaReader } from './ollama';
import { memoryRepos, type Repos } from './repos';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET must be set to a random value of at least 32 characters.');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3100);

let repos: Repos;
if (process.env.MONGODB_URI) {
  // v2 uses its own database name so it can never read or write the data of main.
  const store = await connectMongo(process.env.MONGODB_URI, process.env.MONGODB_DB ?? 'fln_v2');
  await store.ensureIndexes();
  repos = store.repos;
} else {
  console.warn('MONGODB_URI is not set: starting with an in-memory store (local demo only; data is lost on restart).');
  // A demo teacher exists only when a password is given in the environment; nothing is hard-coded.
  const demoPassword = process.env.DEMO_PASSWORD;
  repos = memoryRepos(demoPassword ? {
    schools: [{ id: 'demo', name: 'Demo School' }],
    users: [{ id: 'u_demo', email: 'demo@fln.test', name: 'Demo Teacher', role: 'teacher', schoolId: 'demo', passwordHash: bcrypt.hashSync(demoPassword, 10) }],
  } : {});
}
// Photo reading is optional: without a key and a model the scan route answers 503 and teachers mark by hand.
const reader = process.env.OLLAMA_MODEL
  ? ollamaReader({ host: process.env.OLLAMA_HOST ?? 'https://ollama.com', apiKey: process.env.OLLAMA_API_KEY, model: process.env.OLLAMA_MODEL })
  : undefined;
createApp({ repos, auth: { jwtSecret: secret, tokenHours: 12 }, reader })
  .listen(port, () => console.log(`FLN v2 API listening on :${port}`));
