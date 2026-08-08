import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// db.ts resolves its file-DB path as path.resolve(process.cwd(), 'data'),
// computed once as a top-level const at import time — so this MUST run
// before the calling test file's (dynamic) import of db.ts / auth.ts /
// index.ts, or the chdir has no effect on where the DB reads/writes.
//
// Node's test runner isolates each test *file* into its own process (a
// separate process per file was confirmed empirically before writing this),
// so calling this once per file is safe: no test file can see another
// file's chdir or its temp data/db.json.
export function isolateTestDb(): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'fln-test-'));
  process.chdir(dir);
}
