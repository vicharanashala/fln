import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedPath = path.join(__dirname, 'question_bank_seed.json');
const mapPath = path.join(__dirname, 'skillLevelMap.json');
const joinPath = path.join(__dirname, 'question_subskills.json');

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

try {
  qs = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
} catch (e) {
  console.error('FAIL: could not read or parse question_bank_seed.json -> ' + e.message);
  process.exit(1);
}

if (!Array.isArray(qs)) {
  console.error('FAIL: question_bank_seed.json is not a JSON array');
  process.exit(1);
}

let known = null;
const skillNameById = new Map();

if (fs.existsSync(mapPath)) {
  try {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const skillsMap = map.skills ?? map.levels ?? {};

    known = new Set(
      Object.values(skillsMap)
        .flatMap((entry) =>
          Array.isArray(entry.subskills)
            ? entry.subskills.map((s) => s.id ?? s)
            : []
        )
        .filter(Boolean)
    );

    for (const entry of Object.values(skillsMap)) {
      if (!entry || !Array.isArray(entry.subskills)) continue;
      for (const skill of entry.subskills) {
        const id = skill?.id ?? skill;
        if (id) skillNameById.set(String(id), skill?.name ?? String(id));
      }
    }
  } catch (e) {
    console.error('FAIL: could not read or parse skillLevelMap.json -> ' + e.message);
    process.exit(1);
  }
}

const seen = new Set();
const questionSubskills = [];

for (const q of qs) {
  const id = q.question_id || '(no id)';

  for (const key of [
    'question_id',
    'question',
    'answer',
    'answer_type',
    'topic',
    'subtopic',
    'difficulty',
    'source_level',
  ]) {
    if (q[key] === undefined || q[key] === '') {
      err(id, `missing ${key}`);
    }
  }

  if (seen.has(id)) {
    err(id, 'duplicate question_id');
  }
  seen.add(id);

  const normalizedDifficulty = normalizeDifficulty(q.difficulty);
  if (normalizedDifficulty === null) {
    err(id, `bad difficulty "${q.difficulty}"`);
  }

  if (q.answer_type === 'choice') {
    if (!Array.isArray(q.choices)) {
      err(id, 'answer_type is choice but no choices');
    } else {
      if (!q.choices.includes(q.answer)) {
        err(id, 'answer is not one of the choices');
      }
      if (new Set(q.choices).size !== q.choices.length) {
        err(id, 'duplicate choices');
      }
    }
  }

  if (q.subskills !== undefined) {
    if (!Array.isArray(q.subskills) || q.subskills.length === 0) {
      err(id, 'subskills must be a non-empty array');
    } else {
      for (const subskillId of q.subskills) {
        if (!/^SK\d\d\.\d\d$/.test(subskillId)) {
          err(id, `bad subskill format "${subskillId}"`);
        } else if (known && !known.has(subskillId)) {
          err(id, `subskill ${subskillId} not in skillLevelMap.json`);
        }

        questionSubskills.push({
          question_id: id,
          subskill_id: subskillId,
          skill_name: skillNameById.get(subskillId) ?? subskillId,
          context: q.context ?? null,
          difficulty: normalizedDifficulty,
          source_level: q.source_level ?? null,
          representation: q.representation ?? null,
        });
      }
    }

    if (!REP.includes(q.representation)) {
      err(id, `bad representation "${q.representation}"`);
    }

    if (!CTX.includes(q.context)) {
      err(id, `bad context "${q.context}"`);
    }
  }

  const match = /^(\d+) \+ (\d+) = ?$/.exec(q.question || '');

  if (
    match &&
    Number(match[1]) + Number(match[2]) !== Number(q.answer)
  ) {
    err(id, `${match[1]} + ${match[2]} is not ${q.answer}`);
  }
}

console.log(`Questions: ${qs.length}`);
console.log('Question-subskill join table:');
console.table(questionSubskills);

if (errors.length > 0) {
  console.error(`\nFAIL: ${errors.length} problem(s)\n - ` + errors.join('\n - '));
  process.exit(1);
}

fs.writeFileSync(joinPath, JSON.stringify(questionSubskills, null, 2), 'utf8');

console.log('PASS: all checks OK');
console.log(`Join table saved to: ${joinPath}`);

console.log('\nSample question summary:');

for (const q of qs) {
  const skillsText = q.subskills
    ? q.subskills
        .map((subskillId) => `${subskillId} (${skillNameById.get(subskillId) ?? 'Unknown skill'})`)
        .join(', ')
    : 'N/A';

  console.log(
    `${q.question_id} | skill=${skillsText} | difficulty=${q.difficulty} | source_level=${q.source_level} | representation=${q.representation} | topic=${q.topic} | subtopic=${q.subtopic} | answer=${q.answer} | context=${q.context} | answer_type=${q.answer_type}`
  );
}
