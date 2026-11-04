// Fails if a level number is hard-coded outside packages/curriculum.
// The old repo had ~144 stray 59/93/109 values; v2 allows none.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'Research', 'data', 'assets', '.git', 'docs']);
const ALLOWED = ['packages/curriculum/'];
// Forbidden: MAX_LEVEL-style constants or comparisons against the old caps.
const PATTERNS = [
  /\b(?:level|currentLevel|maxLevel|MAX_LEVEL)\s*(?:<=?|>=?|===?|!==?)\s*(?:59|93|109|91)\b/,
  /\b(?:MAX|TOTAL)_LEVELS?\s*=\s*\d+/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

const problems: string[] = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (ALLOWED.some(a => rel.startsWith(a)) || rel === 'scripts/check-levels.ts') continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (PATTERNS.some(p => p.test(line))) problems.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}
if (problems.length) {
  console.error('Hard-coded level numbers found (import from @fln/curriculum instead):\n' + problems.join('\n'));
  process.exit(1);
}
console.log('PASS  no hard-coded level numbers outside packages/curriculum');
