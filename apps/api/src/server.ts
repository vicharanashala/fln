import { createApp } from './app';
import { connectMongo } from './mongoRepos';
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
  console.warn('MONGODB_URI is not set: starting with an empty in-memory store (local demo only).');
  repos = memoryRepos();
}
createApp({ repos, auth: { jwtSecret: secret, tokenHours: 12 } })
  .listen(port, () => console.log(`FLN v2 API listening on :${port}`));
