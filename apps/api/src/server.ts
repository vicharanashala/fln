import { createApp } from './app';
import { memoryRepos } from './repos';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET must be set to a random value of at least 32 characters.');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3100);
// The MongoDB store is added next; until then the server starts empty (health check only).
createApp({ repos: memoryRepos(), auth: { jwtSecret: secret, tokenHours: 12 } })
  .listen(port, () => console.log(`FLN v2 API listening on :${port}`));
