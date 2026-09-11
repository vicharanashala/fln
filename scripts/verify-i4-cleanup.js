const fs = require('fs');
const { MongoClient } = require('mongodb');
const e = Object.fromEntries(
  fs.readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter(x => x && !x.trim().startsWith('#'))
    .map(x => {
      const i = x.indexOf('=');
      return i > 0
        ? [x.slice(0, i).trim(), x.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        : [x.trim(), ''];
    })
);

(async () => {
  const c = new MongoClient(e.MONGODB_URI, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await c.connect();
  const db = c.db();
  const s = await db.collection('schools').deleteMany({ id: { $in: ['gps-i4-test-001', 'gps-i4-test-002'] } });
  const u = await db.collection('users').deleteMany({ email: { $in: ['p.i4@fln.org', 't.i4.a@fln.org', 't.i4.b@fln.org'] } });
  const l = await db.collection('logs').deleteMany({ schoolId: { $in: ['gps-i4-test-001', 'gps-i4-test-002'] } });
  console.log('schools_deleted=' + s.deletedCount, 'users_deleted=' + u.deletedCount, 'logs_deleted=' + l.deletedCount);
  await c.close();
})().catch(e => { console.error(e.message); process.exit(1); });
