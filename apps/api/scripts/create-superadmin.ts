// Creates a superadmin account in the v2 database. Run on the server, once.
//
//   On the server:  bash deploy/create-superadmin.sh someone@example.org "Full Name"   (asks for the password, hidden)
//   Directly:       NEW_SUPERADMIN_PASSWORD=... MONGODB_URI=... node create-superadmin.mjs <email> "<name>"
//
// The password is read from the environment, never from the command line, so it does not land in shell history.
import bcrypt from 'bcryptjs';
import { passwordProblem } from '../src/auth';
import { connectMongo } from '../src/mongoRepos';

const [email, name] = process.argv.slice(2);
const password = process.env.NEW_SUPERADMIN_PASSWORD;
const uri = process.env.MONGODB_URI;
if (!email || !name || !password || !uri) {
  console.error('Usage: NEW_SUPERADMIN_PASSWORD=... MONGODB_URI=... tsx create-superadmin.ts <email> "<name>"');
  process.exit(1);
}
const problem = passwordProblem(password);
if (problem) { console.error(problem); process.exit(1); }

const store = await connectMongo(uri, process.env.MONGODB_DB ?? 'fln_v2');
try {
  await store.ensureIndexes();
  if (await store.repos.users.byEmail(email)) { console.error('An account with this email already exists. Nothing was changed.'); process.exit(1); }
  const user = await store.repos.users.add({ email, name, role: 'superadmin', passwordHash: await bcrypt.hash(password, 10) });
  console.log(`Superadmin created: ${user.email} (${user.id})`);
} finally {
  await store.close();
}
