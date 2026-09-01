// Seeds the canonical 93-level curriculum into MongoDB.
//
//   npm run seed:levels                  # upsert all 93 levels
//   npm run seed:levels -- --dry-run     # report what would change, write nothing
//
// Why this exists: the 93 levels previously lived only as TypeScript in the
// frontend package, with no queryable home. Every backend feature that needed
// curriculum data hand-authored its own copy — six copies, across two different
// id spaces (1..93 and the retired 1..59 worksheet-engine space). This script
// establishes one source and one destination.
//
// IMPORTANT — this is an ADDITIVE script, deliberately separate from
// `npm run seed`. That script drops all collections before writing, and has
// already silently wiped `questionBank` and `levelHtmlTemplates` once. Run this
// (like `seed:html` and `seed:question-bank`) after any full reseed.
//
// Idempotency contract:
//   - matched on `levelNumber`, which is stable
//   - `conceptId` is written with $setOnInsert and NEVER regenerated, because
//     student evidence points at it; renumbering would orphan real responses
//   - curriculum fields are refreshed on every run, so editing the skill map
//     and re-running is the supported way to correct a level

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SKILL_MAP_PATH = path.join(REPO_ROOT, 'frontend', 'src', 'data', 'skillProgressionMap.ts');
const STATIC_HTML_DIR = path.join(REPO_ROOT, 'FLN SVG HTML files(22-59)');
const WORKSHEET_ENGINE = path.join(REPO_ROOT, 'frontend', 'public', 'worksheets', 'levels_main.html');
const CROSSWALK_PATH = path.join(REPO_ROOT, 'Research', 'fln_59_to_93_crosswalk.json');

const CURRICULUM_VERSION = 'v1';

interface Crosswalk {
  /** "59" -> 93-space levelNumber. Reviewed by the pedagogy team, not inferred. */
  legacy59_to_level: Record<string, number>;
}

/**
 * The 59 -> 93 mapping is a curriculum judgement, so it is an *input* to this
 * script rather than something computed here. Until the reviewed file exists,
 * every level seeds with `legacyLevel59: null` and no content flags — which is
 * honest: we genuinely do not yet know which 93-level owns which old worksheet.
 */
function loadCrosswalk(): Crosswalk | null {
  if (!fs.existsSync(CROSSWALK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CROSSWALK_PATH, 'utf8')) as Crosswalk;
  } catch (err) {
    console.error(`Could not parse ${path.relative(REPO_ROOT, CROSSWALK_PATH)}:`, err);
    process.exit(1);
  }
}

/** Legacy level numbers that have a static worksheet file on disk (levels 22-59). */
function legacyLevelsWithStaticHtml(): Set<number> {
  const out = new Set<number>();
  if (!fs.existsSync(STATIC_HTML_DIR)) return out;
  for (const file of fs.readdirSync(STATIC_HTML_DIR)) {
    const m = file.match(/level(\d+)/);
    if (m) out.add(parseInt(m[1], 10));
  }
  return out;
}

/** Legacy level ids the worksheet engine can actually build (its LEVELS[] table). */
function legacyLevelsWithBuilder(): Set<number> {
  const out = new Set<number>();
  if (!fs.existsSync(WORKSHEET_ENGINE)) return out;
  const html = fs.readFileSync(WORKSHEET_ENGINE, 'utf8');
  for (const m of html.matchAll(/^\{id:(\d+),title:/gm)) {
    out.add(parseInt(m[1], 10));
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Point it at the database you intend to seed.');
    process.exit(1);
  }

  const { LEVEL_SKILL_MAP, CORE_SKILLS } = await import(SKILL_MAP_PATH);
  const subskillsBySkill = new Map<string, string[]>(
    (CORE_SKILLS as any[]).map(s => [s.id, s.subskills.map((ss: any) => ss.id)])
  );
  const domainBySkill = new Map<string, string>(
    (CORE_SKILLS as any[]).map(s => [s.id, s.domain])
  );

  /**
   * A level carries no strand of its own — the strand belongs to the skills it
   * assesses, so it is derived rather than stored twice. Where a level's primary
   * skills span more than one domain the first wins, and the disagreement is
   * reported: a level straddling two strands is usually a taxonomy question
   * worth someone looking at, not a data error to paper over.
   */
  const straddling: string[] = [];
  function strandFor(level: any): string {
    const domains = Array.from(new Set(
      (level.primarySkills as string[]).map(sk => domainBySkill.get(sk)).filter(Boolean)
    )) as string[];
    if (domains.length === 0) return 'Unspecified';
    if (domains.length > 1) straddling.push(`L${level.levelNumber} (${domains.join(' / ')})`);
    return domains[0];
  }

  const crosswalk = loadCrosswalk();
  const staticHtml = legacyLevelsWithStaticHtml();
  const builders = legacyLevelsWithBuilder();

  /**
   * Invert the crosswalk once, and refuse to silently pick a winner when two
   * legacy levels claim the same 93-level.
   *
   * This is the "split" case the migration plan flags as a curriculum decision:
   * the finer 93 taxonomy means one old worksheet can legitimately correspond to
   * more than one new level, and *which* one inherits the content is a judgement
   * nobody should make by accident. Seeding the first match and dropping the rest
   * would lose content quietly, so collisions abort the run.
   */
  const levelToLegacy = new Map<number, number>();
  if (crosswalk?.legacy59_to_level) {
    const collisions: string[] = [];
    for (const [legacyStr, levelNumber] of Object.entries(crosswalk.legacy59_to_level)) {
      const legacy = Number(legacyStr);
      const claimed = levelToLegacy.get(levelNumber);
      if (claimed !== undefined) {
        collisions.push(`L${levelNumber} claimed by legacy ${claimed} and ${legacy}`);
        continue;
      }
      levelToLegacy.set(levelNumber, legacy);
    }
    if (collisions.length) {
      console.error('');
      console.error(`Crosswalk has ${collisions.length} collision(s) — two legacy levels mapped to one 93-level:`);
      for (const c of collisions) console.error(`  ${c}`);
      console.error('');
      console.error('Decide which level inherits the content (or split it deliberately), then re-run.');
      console.error('Nothing was written.');
      process.exit(1);
    }
  }

  if (!crosswalk) {
    console.warn(
      `No crosswalk at ${path.relative(REPO_ROOT, CROSSWALK_PATH)} — seeding with ` +
      `legacyLevel59: null and no content flags. Re-run once the reviewed crosswalk lands.`
    );
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const coll = client.db().collection('curriculumLevels');

  let inserted = 0, updated = 0;
  const now = new Date().toISOString();

  for (const level of LEVEL_SKILL_MAP as any[]) {
    const skills: string[] = Array.from(
      new Set([...level.primarySkills, ...level.supportingSkills])
    );
    const subskills = Array.from(
      new Set(skills.flatMap(sk => subskillsBySkill.get(sk) ?? []))
    ).sort();

    const legacyLevel59 = levelToLegacy.get(level.levelNumber) ?? null;

    const fields = {
      sCode: level.sCode,
      legacyLevel59,
      stage: level.stage,
      capability: level.capability,
      strand: strandFor(level),
      primarySkills: level.primarySkills,
      supportingSkills: level.supportingSkills,
      subskills,
      hasStaticHtml: legacyLevel59 !== null && staticHtml.has(legacyLevel59),
      hasBuilder: legacyLevel59 !== null && builders.has(legacyLevel59),
      curriculumVersion: CURRICULUM_VERSION,
      updatedAt: now,
    };

    if (dryRun) {
      const existing = await coll.findOne({ levelNumber: level.levelNumber });
      existing ? updated++ : inserted++;
      continue;
    }

    const res = await coll.updateOne(
      { levelNumber: level.levelNumber },
      {
        // conceptId and createdAt are written once and never touched again.
        $setOnInsert: { conceptId: 'cpt_' + randomUUID().slice(0, 12), createdAt: now },
        $set: fields,
      },
      { upsert: true }
    );
    res.upsertedCount ? inserted++ : updated++;
  }

  if (!dryRun) {
    await coll.createIndex({ levelNumber: 1 }, { unique: true });
    await coll.createIndex({ conceptId: 1 }, { unique: true });
    await coll.createIndex({ legacyLevel59: 1 });
    await coll.createIndex({ strand: 1 });
  }

  const all = await coll.find({}).toArray();
  const withHtml = all.filter(l => l.hasStaticHtml).length;
  const withBuilder = all.filter(l => l.hasBuilder).length;
  const mapped = all.filter(l => l.legacyLevel59 !== null).length;

  console.log(`${dryRun ? '[dry-run] ' : ''}curriculumLevels: ${inserted} inserted, ${updated} updated`);
  console.log(`  total levels:            ${all.length}`);
  console.log(`  mapped from legacy 59:   ${mapped}`);
  console.log(`  with static HTML:        ${withHtml}`);
  console.log(`  with worksheet builder:  ${withBuilder}`);
  console.log(`  renderable (either):     ${all.filter(l => l.hasStaticHtml || l.hasBuilder).length} / ${all.length}`);

  if (straddling.length) {
    console.log('');
    console.log(`  note: ${straddling.length} level(s) have primary skills spanning multiple strands —`);
    console.log(`  first domain used, worth a taxonomy review: ${straddling.slice(0, 8).join(', ')}${straddling.length > 8 ? ` (+${straddling.length - 8} more)` : ''}`);
  }

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
