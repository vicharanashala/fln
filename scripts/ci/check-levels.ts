// Level-count consistency check.
//
// The curriculum has grown 59 -> 93 -> 109 levels and every growth left stale
// copies of the old number behind (Math.min(59, ...) caps, "93 levels" labels,
// loops to 93). This check makes the next growth safe:
//
//   1. The single source of truth is CURRICULUM_MAPPING (backend/src/config/
//      curriculumMap.ts). Every other place that knows the level count must agree
//      with it: skillLevelMap.json, the frontend LEVEL_SKILL_MAP, the class
//      ranges in DBStore.classLevelRange, and the level-history file.
//   2. scripts/ci/level-history.json records the current count and every count
//      the curriculum used to have. When levels are added, this check fails
//      until the file is updated (move the old count into "retired"), and from
//      then on any leftover literal of the old count in code is reported.
//   3. Literals of a retired count used as a level cap/loop bound are reported.
//      Existing ones are listed in scripts/ci/levels-baseline.txt so they do
//      not block unrelated PRs; only NEW ones fail. Fix one and delete its line.
//
// Usage:
//   npx tsx scripts/ci/check-levels.ts            # check (CI); exit 1 on a new problem
//   npx tsx scripts/ci/check-levels.ts --list     # print every finding, ignoring the baseline
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

async function main() {
  const listAll = process.argv.includes('--list');

  // ---------------------------------------------------------------- 1. truth
  const { CURRICULUM_MAPPING } = await import(pathToFileURL(path.join(ROOT, 'backend/src/config/curriculumMap.ts')).href);
  const levels = Object.values(CURRICULUM_MAPPING) as Array<{ levelNumber: number; conceptId: string; stage: number }>;
  const N = levels.length;

  // contiguous 1..N, key matches levelNumber, concept ids unique, stages never go backwards
  const seenConcepts = new Map<string, number>();
  let prevStage = 0;
  for (let n = 1; n <= N; n++) {
    const lv = (CURRICULUM_MAPPING as any)[n];
    if (!lv) { fail(`curriculumMap.ts: level ${n} is missing — levels must run 1..${N} with no gaps`); continue; }
    if (lv.levelNumber !== n) fail(`curriculumMap.ts: key ${n} holds levelNumber ${lv.levelNumber}`);
    if (seenConcepts.has(lv.conceptId)) fail(`curriculumMap.ts: conceptId ${lv.conceptId} is used by level ${seenConcepts.get(lv.conceptId)} and level ${n}`);
    seenConcepts.set(lv.conceptId, n);
    if (lv.stage < prevStage) fail(`curriculumMap.ts: level ${n} is in stage ${lv.stage} after a level in stage ${prevStage} — stages must not go backwards`);
    prevStage = lv.stage;
  }

  // ------------------------------------------------------ 2. other count owners
  const snapshot = JSON.parse(read('backend/src/data/skillLevelMap.json'));
  if (snapshot.levelCount !== N) fail(`backend/src/data/skillLevelMap.json: levelCount is ${snapshot.levelCount}, curriculumMap.ts has ${N} levels — run: npx tsx scripts/generate-skill-level-map.ts`);
  if (Object.keys(snapshot.levels).length !== N) fail(`backend/src/data/skillLevelMap.json: holds ${Object.keys(snapshot.levels).length} level entries, curriculumMap.ts has ${N}`);

  const fe = await import(pathToFileURL(path.join(ROOT, 'frontend/src/data/skillProgressionMap.ts')).href);
  if (fe.LEVEL_SKILL_MAP.length !== N) fail(`frontend/src/data/skillProgressionMap.ts: LEVEL_SKILL_MAP has ${fe.LEVEL_SKILL_MAP.length} levels, curriculumMap.ts has ${N}`);

  // DBStore.classLevelRange: the class ranges must tile 1.. N without a gap or overlap
  const dbSrc = read('backend/src/db.ts');
  const fn = dbSrc.match(/static classLevelRange\([^)]*\)[^{]*\{([\s\S]*?)\n  \}/);
  if (!fn) {
    fail('backend/src/db.ts: could not find classLevelRange() — update scripts/ci/check-levels.ts if it moved');
  } else {
    const ranges = [...fn[1].matchAll(/min:\s*(\d+),\s*max:\s*(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    if (ranges.length === 0) fail('backend/src/db.ts: classLevelRange() has no { min, max } ranges');
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i][0] !== ranges[i - 1][1] + 1) fail(`backend/src/db.ts classLevelRange(): class range ${i + 1} starts at ${ranges[i][0]} but the previous range ends at ${ranges[i - 1][1]} — ranges must be contiguous`);
    }
    if (ranges.length && ranges[ranges.length - 1][1] !== N) fail(`backend/src/db.ts classLevelRange(): the last class range ends at ${ranges[ranges.length - 1][1]}, but the curriculum has ${N} levels`);
  }

  // ----------------------------------------------------- 3. level history file
  const histPath = 'scripts/ci/level-history.json';
  const hist: { current: number; retired: number[] } = JSON.parse(read(histPath));
  if (hist.current !== N) {
    fail(`${histPath}: says the curriculum has ${hist.current} levels, but curriculumMap.ts has ${N}. ` +
      `Levels were added or removed — set "current" to ${N} and add ${hist.current} to "retired" so leftover ${hist.current}s are found.`);
  }
  const retired = new Set(hist.retired.filter(r => r !== N));

  // -------------------------------------------------------- 4. stale literals
  // Code: a retired count used as a cap / bound / loop limit.  Comments are skipped.
  const codeDirs = ['backend/src', 'frontend/src'];
  const skip = /(\.test\.|\.check\.|\/tests\/|\/__checks__\/|\/dist\/|node_modules|skillLevelMap\.json|\.seed\.)/;
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p); }
      else if (/\.(ts|tsx)$/.test(e.name) && !skip.test(p)) files.push(p);
    }
  };
  codeDirs.forEach(walk);

  const retiredAlt = [...retired].join('|');
  const findings: Array<{ key: string; text: string }> = [];
  if (retired.size) {
    const code = new RegExp(
      `(Math\\.(?:min|max)\\(\\s*(?:${retiredAlt})\\s*,|,\\s*(?:${retiredAlt})\\s*\\)|length:\\s*(?:${retiredAlt})\\b|[<>]=?\\s*(?:${retiredAlt})\\b|\\b(?:${retiredAlt})\\s*[<>]=?|===?\\s*(?:${retiredAlt})\\b|\\b(?:${retiredAlt})\\s*===?)`);
    const label = new RegExp(`\\b(?:${retiredAlt})[ -]levels?\\b|\\b(?:${retiredAlt}) (?:FLN|curriculum) levels?\\b`, 'i');
    for (const f of files) {
      const lines = read(f).split('\n');
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        // only lines that are about levels, so an unrelated `x < 59` is not reported
        const aboutLevels = /level|Level|LEVEL/.test(line) || /Math\.(min|max)\(\s*(?:\d+)\s*,/.test(line)
          || new RegExp(`for \\(let \\w+ = [01]; \\w+ <=? (?:${retiredAlt})\\b`).test(line);
        if ((code.test(line) && aboutLevels) || label.test(line)) {
          findings.push({ key: `${f} :: ${t}`, text: `${f}:${i + 1}  ${t.slice(0, 110)}` });
        }
      });
    }
    // Docs that state the level count to readers
    for (const f of ['README.md', 'SRS.md', 'PRD.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md', 'AGENTS.md', 'CLAUDE.md']) {
      if (!fs.existsSync(path.join(ROOT, f))) continue;
      read(f).split('\n').forEach((line, i) => {
        if (label.test(line) && !/(was|were|from|before|old|legacy|previous|retired|migrat|→|->|crosswalk|93-level taxonomy|Research\/)/i.test(line)) {
          findings.push({ key: `${f} :: ${line.trim()}`, text: `${f}:${i + 1}  ${line.trim().slice(0, 110)}` });
        }
      });
    }
  }

  // ---------------------------------------------------------------- baseline
  const baselinePath = path.join(ROOT, 'scripts/ci/levels-baseline.txt');
  const baseline = new Set(
    fs.existsSync(baselinePath)
      ? fs.readFileSync(baselinePath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.trim())
      : []);

  if (listAll) {
    findings.forEach(f => console.log(f.key));
    console.log(`\n${findings.length} stale-level finding(s); level count ${N}; retired ${[...retired].join(', ')}`);
    return;
  }

  const live = new Set(findings.map(f => f.key));
  const fresh = findings.filter(f => !baseline.has(f.key));
  const fixed = [...baseline].filter(k => !live.has(k));
  fresh.forEach(f => fail(`stale level number (a retired count ${[...retired].join('/')}) — derive it from LEVEL_COUNT / MAX_FLN_LEVEL instead:\n      ${f.text}`));

  console.log(`levels: ${N} in curriculumMap.ts | skillLevelMap.json ${snapshot.levelCount} | frontend map ${fe.LEVEL_SKILL_MAP.length} | history says ${hist.current}`);
  console.log(`stale literals: ${findings.length} found, ${findings.length - fresh.length} already in the baseline, ${fresh.length} new`);
  if (fixed.length) {
    console.log(`\n${fixed.length} baseline line(s) no longer match anything — delete them from scripts/ci/levels-baseline.txt:`);
    fixed.forEach(k => console.log(`  ${k}`));
  }
  if (problems.length) {
    console.error(`\nFAILED — ${problems.length} problem(s):`);
    problems.forEach(p => console.error(`  - ${p}`));
    process.exit(1);
  }
  console.log('OK');
}

main().catch(e => { console.error(e); process.exit(1); });
