
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedPath = path.join(__dirname, 'question_bank_seed.json');
const mapPath = path.join(__dirname, 'skillLevelMap.json');

const REP = [
  'concrete',
  'pictorial',
  'symbolic',
  'verbal',
  'number_line',
  'equation_completion',
  'place_value_chart',
  'decomposition',
  'error_analysis',
];
const CTX = ['direct', 'real_world'];
const LEGACY_DIFF = new Set(['easy', 'medium', 'hard']);
const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

const normalizeDifficulty = (value) => {
  if (value === 1 || value === 2 || value === 3) return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'easy') return 1;
  if (text === 'medium') return 2;
  if (text === 'hard') return 3;
  return null;
};

let qs;
try { qs = JSON.parse(fs.readFileSync(seedPath, 'utf8')); }
catch (e) { console.error('FAIL: not valid JSON -> ' + e.message); process.exit(1); }
if (!Array.isArray(qs)) { console.error('FAIL: file is not a JSON array'); process.exit(1); }

let known = null;
if (fs.existsSync(mapPath)) {
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const skillsMap = map.skills ?? map.levels ?? {};
  known = new Set(
    Object.values(skillsMap)
      .flatMap((entry) => Array.isArray(entry.subskills) ? entry.subskills.map(s => s.id ?? s) : [])
      .filter(Boolean)
  );
}

const seen = new Set();
const bySub = {};
for (const q of qs) {
  const id = q.question_id || '(no id)';
  for (const k of ['question_id', 'question', 'answer', 'answer_type', 'topic', 'subtopic', 'difficulty', 'source_level'])
    if (q[k] === undefined || q[k] === '') err(id, `missing ${k}`);
  if (seen.has(id)) err(id, 'duplicate question_id');
  seen.add(id);

  const normalizedDifficulty = normalizeDifficulty(q.difficulty);
  if (normalizedDifficulty === null) err(id, `bad difficulty "${q.difficulty}"`);

  if (q.answer_type === 'choice') {
    if (!Array.isArray(q.choices)) err(id, 'answer_type is choice but no choices');
    else {
      if (!q.choices.includes(q.answer)) err(id, 'answer is not one of the choices');
      if (new Set(q.choices).size !== q.choices.length) err(id, 'duplicate choices');
    }
  }

  if (q.subskills !== undefined) {
    if (!Array.isArray(q.subskills) || q.subskills.length === 0) err(id, 'subskills must be a non-empty array');
    else for (const s of q.subskills) {
      if (!/^SK\d\d\.\d\d$/.test(s)) err(id, `bad subskill format "${s}"`);
      else if (known && !known.has(s)) err(id, `subskill ${s} not in skillLevelMap.json`);
      bySub[s] = (bySub[s] || 0) + 1;
    }
    if (!REP.includes(q.representation)) err(id, `bad representation "${q.representation}"`);
    if (!CTX.includes(q.context)) err(id, `bad context "${q.context}"`);
  }

  const m = /^(\d+) \+ (\d+) = \?$/.exec(q.question || '');
  if (m && Number(m[1]) + Number(m[2]) !== Number(q.answer)) err(id, `${m[1]} + ${m[2]} is not ${q.answer}`);
}

console.log(`Questions: ${qs.length}`);
console.log('By subskill:', bySub);
if (errors.length) { console.error(`\nFAIL: ${errors.length} problem(s)\n - ` + errors.join('\n - ')); process.exit(1); }
console.log('PASS: all checks OK');

console.log('\nSample question summary:');
for (const q of qs) {
  console.log(
    `${q.question_id} | skill=${q.subskills ? q.subskills.join(', ') : 'N/A'} | difficulty=${q.difficulty} | source_level=${q.source_level} | representation=${q.representation} | topic=${q.topic} | subtopic=${q.subtopic} | answer=${q.answer} | context=${q.context} | answer_type=${q.answer_type}`
  );
}