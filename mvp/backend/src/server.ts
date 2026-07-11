import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { runSeed } from './seed.js';

async function main() {
  await connectDatabase();
  await runSeed(); // idempotent demo data

  createApp().listen(env.port, () => {
    console.log(`\n  FLN server running on http://localhost:${env.port}`);
    console.log(`  API base: http://localhost:${env.port}/api\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
