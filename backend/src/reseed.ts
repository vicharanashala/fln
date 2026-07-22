// Offline database (re)seed — the bootstrap companion to the now-superadmin-only
// POST /api/reset.
//
// It wipes every collection and re-seeds from getSeedData() (the canonical demo
// dataset), which includes bcrypt password hashes for the seed accounts. Use this
// to initialize a fresh deployment, or to recover login on an older database whose
// users predate the password-hash change — a case the HTTP reset can no longer
// handle, since it now requires a superadmin who wouldn't yet be able to log in.
//
//   cd backend && MONGODB_URI=... npm run reseed
import 'dotenv/config';
import { connectDB, dbStore } from './db';

async function main() {
  await connectDB();
  await dbStore.reset();
  console.log('[reseed] Database reset and seeded from getSeedData() (with password hashes).');
  process.exit(0);
}

main().catch((err) => {
  console.error('[reseed] Failed:', err);
  process.exit(1);
});
