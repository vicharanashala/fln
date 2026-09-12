// 93 FLN Levels → 24 Core Skills (SK01-SK24) → ~150 Granular Subskills
// Source: docs/skill-graph/FLN_93_Level_Skill_Graph_Specification.md
//         (the canonical spec the project adopted Sep 2026)
//
// This file REPLACES the previous 27-level-only layer. The earlier work
// (Pre-school 1/2/3) is preserved verbatim — see the L1-L27 entries below.
// Levels L28-L93 (Class 1 → Class 4) are now also mapped.

export type SkillDomain =
  | 'Pre-number'
  | 'Number Sense'
  | 'Number Operations'
  | 'Fractions'
  | 'Patterns'
  | 'Shapes & Spatial'
  | 'Measurement'
  | 'Calendar & Time'
  | 'Money'
  | 'Data'
  | 'Cross-cutting';

export type RelationshipType =
  | 'supports'
  | 'often_precedes'
  | 'related_to'
  | 'required_for_procedure';

// ─────────────────────────────────────────────────────────────────────────────
// 24 Core Skills (Spec §2: SK01-SK24)
// ─────────────────────────────────────────────────────────────────────────────

export interface Subskill {
  id: string;            // dotted: "SK01.01"
  name: string;
  observable: boolean;
}

export interface CoreSkill {
  id: string;            // "SK01"
  name: string;          // "One-to-One Correspondence"
  domain: SkillDomain;
  definition: string;    // brief
  subskills: Subskill[];
}

export const CORE_SKILLS: CoreSkill[] = [
  { id: 'SK01', name: 'One-to-One Correspondence', domain: 'Pre-number',
    definition: 'Matching each item in one set to exactly one item in another.',
    subskills: [
      { id: 'SK01.01', name: 'Match one object to one object', observable: true },
      { id: 'SK01.02', name: 'Match objects across two groups', observable: true },
      { id: 'SK01.03', name: 'Maintain one-to-one correspondence while counting', observable: true },
      { id: 'SK01.04', name: 'Identify unmatched objects', observable: true },
    ]},
  { id: 'SK02', name: 'Classification', domain: 'Pre-number',
    definition: 'Grouping objects by shared property and identifying non-members.',
    subskills: [
      { id: 'SK02.01', name: 'Classify by one property', observable: true },
      { id: 'SK02.02', name: 'Identify common property', observable: true },
      { id: 'SK02.03', name: 'Identify odd object', observable: true },
      { id: 'SK02.04', name: 'Classify by multiple properties', observable: true },
      { id: 'SK02.05', name: 'Flexible reclassification', observable: true },
    ]},
  { id: 'SK03', name: 'Seriation & Ordering', domain: 'Pre-number',
    definition: 'Arranging objects or numbers by a quantitative attribute.',
    subskills: [
      { id: 'SK03.01', name: 'Arrange three objects by size', observable: true },
      { id: 'SK03.02', name: 'Arrange objects by length', observable: true },
      { id: 'SK03.03', name: 'Use comparative relationships', observable: true },
      { id: 'SK03.04', name: 'Apply transitivity', observable: false },
      { id: 'SK03.05', name: 'Order numerals', observable: true },
      { id: 'SK03.06', name: 'Order numbers ascending', observable: true },
      { id: 'SK03.07', name: 'Order numbers descending', observable: true },
    ]},
  { id: 'SK04', name: 'Same/Different & Attribute Recognition', domain: 'Pre-number',
    definition: 'Identifying visual and shape attributes of objects.',
    subskills: [
      { id: 'SK04.01', name: 'Perceptual same/different', observable: true },
      { id: 'SK04.02', name: 'Identify visual attributes', observable: true },
      { id: 'SK04.03', name: 'Identify shape attributes', observable: true },
      { id: 'SK04.04', name: 'Identify object differences', observable: true },
    ]},
  { id: 'SK05', name: 'Counting & Counting Sequence', domain: 'Number Sense',
    definition: 'Producing number words in order to enumerate.',
    subskills: [
      { id: 'SK05.01', name: 'Rote counting to 10', observable: true },
      { id: 'SK05.02', name: 'Count objects 1-3', observable: true },
      { id: 'SK05.03', name: 'Count to 5', observable: true },
      { id: 'SK05.04', name: 'Count to 10', observable: true },
      { id: 'SK05.05', name: 'Count to 20', observable: true },
      { id: 'SK05.06', name: 'Count to 50', observable: true },
      { id: 'SK05.07', name: 'Count to 100', observable: true },
      { id: 'SK05.08', name: 'Count forward from a given number', observable: true },
      { id: 'SK05.09', name: 'Count backward', observable: true },
    ]},
  { id: 'SK06', name: 'Cardinality', domain: 'Number Sense',
    definition: 'The last number said in a count tells how many.',
    subskills: [
      { id: 'SK06.01', name: 'Understand last number counted as total', observable: true },
      { id: 'SK06.02', name: 'Count small sets', observable: true },
      { id: 'SK06.03', name: 'Count and tell how many', observable: true },
      { id: 'SK06.04', name: 'Relate quantity to numeral', observable: true },
    ]},
  { id: 'SK07', name: 'Subitizing', domain: 'Number Sense',
    definition: 'Recognising small quantities without counting.',
    subskills: [
      { id: 'SK07.01', name: 'Perceptual subitizing', observable: true },
      { id: 'SK07.02', name: 'Recognize small quantity without counting', observable: true },
      { id: 'SK07.03', name: 'Conceptual subitizing', observable: true },
      { id: 'SK07.04', name: 'Compose quantity from subgroups', observable: true },
    ]},
  { id: 'SK08', name: 'Quantity & Numeral Representation', domain: 'Number Sense',
    definition: 'Showing numerals, reading, writing, matching to quantity.',
    subskills: [
      { id: 'SK08.01', name: 'Recognize numerals 1-10', observable: true },
      { id: 'SK08.02', name: 'Match numeral to quantity', observable: true },
      { id: 'SK08.03', name: 'Represent quantity with objects', observable: true },
      { id: 'SK08.04', name: 'Read numerals', observable: true },
      { id: 'SK08.05', name: 'Write numerals', observable: true },
      { id: 'SK08.06', name: 'Read/write numbers to 99', observable: true },
      { id: 'SK08.07', name: 'Read/write three-digit numbers', observable: true },
      { id: 'SK08.08', name: 'Read/write four-digit numbers', observable: true },
    ]},
  { id: 'SK09', name: 'Number Comparison', domain: 'Number Sense',
    definition: 'Determining which of two numbers is greater, lesser, or equal.',
    subskills: [
      { id: 'SK09.01', name: 'Compare quantities', observable: true },
      { id: 'SK09.02', name: 'More/less/equal', observable: true },
      { id: 'SK09.03', name: 'Compare numerals using objects', observable: true },
      { id: 'SK09.04', name: 'Abstract numeral comparison', observable: true },
      { id: 'SK09.05', name: 'Compare close numbers', observable: true },
      { id: 'SK09.06', name: 'Compare two-digit numbers', observable: true },
      { id: 'SK09.07', name: 'Compare three-digit numbers', observable: true },
    ]},
  { id: 'SK10', name: 'Number Sequencing & Number Line', domain: 'Number Sense',
    definition: 'Locating numbers on a sequence or number line.',
    subskills: [
      { id: 'SK10.01', name: 'Numeral sequencing', observable: true },
      { id: 'SK10.02', name: 'Before', observable: true },
      { id: 'SK10.03', name: 'After', observable: true },
      { id: 'SK10.04', name: 'Between', observable: true },
      { id: 'SK10.05', name: 'Missing number', observable: true },
      { id: 'SK10.06', name: 'Ordinal position', observable: true },
      { id: 'SK10.07', name: 'Informal number line 0-20', observable: true },
      { id: 'SK10.08', name: 'Number line 0-100', observable: true },
    ]},
  { id: 'SK11', name: 'Place Value & Base-Ten Structure', domain: 'Number Sense',
    definition: 'Understanding that the position of a digit determines its value.',
    subskills: [
      { id: 'SK11.01', name: 'Understand groups of ten', observable: true },
      { id: 'SK11.02', name: 'Tens and ones', observable: true },
      { id: 'SK11.03', name: 'Tens as bundles', observable: true },
      { id: 'SK11.04', name: 'Zero as placeholder', observable: true },
      { id: 'SK11.05', name: 'Two-digit place value', observable: true },
      { id: 'SK11.06', name: 'Three-digit place value', observable: true },
      { id: 'SK11.07', name: 'Expanded form', observable: true },
      { id: 'SK11.08', name: 'Four-digit place value', observable: true },
      { id: 'SK11.09', name: 'Five-digit place value', observable: true },
    ]},
  { id: 'SK12', name: 'Number Composition & Decomposition', domain: 'Number Sense',
    definition: 'Breaking a number into parts and recombining them.',
    subskills: [
      { id: 'SK12.01', name: 'Compose quantities', observable: true },
      { id: 'SK12.02', name: 'Decompose quantities', observable: true },
      { id: 'SK12.03', name: 'Flexible two-digit decomposition', observable: true },
      { id: 'SK12.04', name: 'Flexible three-digit decomposition', observable: true },
      { id: 'SK12.05', name: 'Expanded form (decomposition)', observable: true },
      { id: 'SK12.06', name: 'Regroup quantities', observable: true },
    ]},
  { id: 'SK13', name: 'Addition', domain: 'Number Operations',
    definition: 'Combining to find the total.',
    subskills: [
      { id: 'SK13.01', name: 'Combine sets', observable: true },
      { id: 'SK13.02', name: 'Concrete addition', observable: true },
      { id: 'SK13.03', name: 'Single-digit addition', observable: true },
      { id: 'SK13.04', name: 'Addition within 20', observable: true },
      { id: 'SK13.05', name: 'Addition within 30', observable: true },
      { id: 'SK13.06', name: 'Two-digit addition', observable: true },
      { id: 'SK13.07', name: 'Addition with regrouping', observable: true },
      { id: 'SK13.08', name: 'Three-digit addition', observable: true },
      { id: 'SK13.09', name: 'Multi-digit addition', observable: true },
      { id: 'SK13.10', name: 'Addition word problems', observable: true },
    ]},
  { id: 'SK14', name: 'Subtraction', domain: 'Number Operations',
    definition: 'Taking away or finding the difference.',
    subskills: [
      { id: 'SK14.01', name: 'Take away', observable: true },
      { id: 'SK14.02', name: 'Concrete subtraction', observable: true },
      { id: 'SK14.03', name: 'Single-digit subtraction', observable: true },
      { id: 'SK14.04', name: 'Subtraction within 20', observable: true },
      { id: 'SK14.05', name: 'Subtraction within 30', observable: true },
      { id: 'SK14.06', name: 'Two-digit subtraction', observable: true },
      { id: 'SK14.07', name: 'Subtraction with regrouping', observable: true },
      { id: 'SK14.08', name: 'Three-digit subtraction', observable: true },
      { id: 'SK14.09', name: 'Multi-digit subtraction', observable: true },
      { id: 'SK14.10', name: 'Subtraction word problems', observable: true },
    ]},
  { id: 'SK15', name: 'Multiplication', domain: 'Number Operations',
    definition: 'Repeated addition / scaling.',
    subskills: [
      { id: 'SK15.01', name: 'Equal groups', observable: true },
      { id: 'SK15.02', name: 'Repeated addition', observable: true },
      { id: 'SK15.03', name: 'Skip-count connection', observable: true },
      { id: 'SK15.04', name: 'Multiplication facts 2,3,4,5,10', observable: true },
      { id: 'SK15.05', name: 'Tables 2-10', observable: true },
      { id: 'SK15.06', name: 'Multi-digit multiplication', observable: true },
      { id: 'SK15.07', name: 'Multiplication word problems', observable: true },
    ]},
  { id: 'SK16', name: 'Division', domain: 'Number Operations',
    definition: 'Splitting into equal shares or groups.',
    subskills: [
      { id: 'SK16.01', name: 'Equal sharing', observable: true },
      { id: 'SK16.02', name: 'Equal grouping', observable: true },
      { id: 'SK16.03', name: 'Division facts', observable: true },
      { id: 'SK16.04', name: 'Relation to multiplication', observable: true },
      { id: 'SK16.05', name: 'Division procedures', observable: true },
      { id: 'SK16.06', name: 'Long division', observable: true },
      { id: 'SK16.07', name: 'Division word problems', observable: true },
    ]},
  { id: 'SK17', name: 'Fractions', domain: 'Fractions',
    definition: 'Equal parts of a whole; notation and equivalence.',
    subskills: [
      { id: 'SK17.01', name: 'Equal parts', observable: true },
      { id: 'SK17.02', name: 'Half', observable: true },
      { id: 'SK17.03', name: 'Quarter', observable: true },
      { id: 'SK17.04', name: 'Fraction notation', observable: true },
      { id: 'SK17.05', name: 'Equivalent fractions', observable: true },
    ]},
  { id: 'SK18', name: 'Patterns & Generalization', domain: 'Patterns',
    definition: 'Identifying, extending, and generalizing rules in sequences.',
    subskills: [
      { id: 'SK18.01', name: 'Identify repeating pattern', observable: true },
      { id: 'SK18.02', name: 'Extend pattern', observable: true },
      { id: 'SK18.03', name: 'Copy pattern', observable: true },
      { id: 'SK18.04', name: 'Two-item pattern', observable: true },
      { id: 'SK18.05', name: 'Three-item pattern', observable: true },
      { id: 'SK18.06', name: 'Number pattern', observable: true },
      { id: 'SK18.07', name: 'Skip-count pattern', observable: true },
      { id: 'SK18.08', name: 'Identify pattern rule', observable: false },
      { id: 'SK18.09', name: 'Generalize pattern', observable: false },
      { id: 'SK18.10', name: 'Advanced number pattern', observable: true },
    ]},
  { id: 'SK19', name: 'Shapes & Spatial Reasoning', domain: 'Shapes & Spatial',
    definition: 'Recognising, comparing, composing, and reasoning about shapes.',
    subskills: [
      { id: 'SK19.01', name: 'Shape matching', observable: true },
      { id: 'SK19.02', name: 'Identify basic shapes', observable: true },
      { id: 'SK19.03', name: 'Identify shape properties', observable: true },
      { id: 'SK19.04', name: 'Compose shapes', observable: true },
      { id: 'SK19.05', name: 'Decompose shapes', observable: true },
      { id: 'SK19.06', name: 'Identify 2D shapes', observable: true },
      { id: 'SK19.07', name: 'Identify 3D shapes', observable: true },
      { id: 'SK19.08', name: 'Spatial vocabulary', observable: true },
      { id: 'SK19.09', name: 'Relate 2D faces to 3D solids', observable: true },
      { id: 'SK19.10', name: 'Nets', observable: true },
      { id: 'SK19.11', name: 'Perspective', observable: false },
      { id: 'SK19.12', name: 'Angles and turns', observable: true },
      { id: 'SK19.13', name: 'Symmetry', observable: true },
      { id: 'SK19.14', name: 'Reflection', observable: true },
    ]},
  { id: 'SK20', name: 'Measurement', domain: 'Measurement',
    definition: 'Comparing and quantifying length, capacity, area, perimeter.',
    subskills: [
      { id: 'SK20.01', name: 'Compare length', observable: true },
      { id: 'SK20.02', name: 'Compare size', observable: true },
      { id: 'SK20.03', name: 'Compare capacity', observable: true },
      { id: 'SK20.04', name: 'Estimate length', observable: true },
      { id: 'SK20.05', name: 'Estimate capacity', observable: true },
      { id: 'SK20.06', name: 'Use non-standard units', observable: true },
      { id: 'SK20.07', name: 'Use uniform units', observable: true },
      { id: 'SK20.08', name: 'Standard measurement units', observable: true },
      { id: 'SK20.09', name: 'Unit conversion', observable: true },
      { id: 'SK20.10', name: 'Applied measurement', observable: true },
      { id: 'SK20.11', name: 'Perimeter', observable: true },
      { id: 'SK20.12', name: 'Area', observable: true },
    ]},
  { id: 'SK21', name: 'Time & Calendar', domain: 'Calendar & Time',
    definition: 'Reading clocks, calendars, computing elapsed time.',
    subskills: [
      { id: 'SK21.01', name: 'Day/night concepts', observable: true },
      { id: 'SK21.02', name: 'Calendar structure', observable: true },
      { id: 'SK21.03', name: 'Days/weeks/months', observable: true },
      { id: 'SK21.04', name: 'Read calendar', observable: true },
      { id: 'SK21.05', name: 'Tell time to hour', observable: true },
      { id: 'SK21.06', name: 'Tell time to half-hour', observable: true },
      { id: 'SK21.07', name: 'Calculate elapsed time', observable: true },
      { id: 'SK21.08', name: 'Advanced time problems', observable: true },
    ]},
  { id: 'SK22', name: 'Money', domain: 'Money',
    definition: 'Recognising currency and computing amounts.',
    subskills: [
      { id: 'SK22.01', name: 'Recognize currency', observable: true },
      { id: 'SK22.02', name: 'Match currency to value', observable: true },
      { id: 'SK22.03', name: 'Combine amounts', observable: true },
      { id: 'SK22.04', name: 'Calculate total cost', observable: true },
      { id: 'SK22.05', name: 'Calculate change', observable: true },
      { id: 'SK22.06', name: 'Multi-step money problems', observable: true },
    ]},
  { id: 'SK23', name: 'Data Handling', domain: 'Data',
    definition: 'Sorting, tallying, reading and interpreting data displays.',
    subskills: [
      { id: 'SK23.01', name: 'Sort data', observable: true },
      { id: 'SK23.02', name: 'Classify data', observable: true },
      { id: 'SK23.03', name: 'Tally', observable: true },
      { id: 'SK23.04', name: 'Count categories', observable: true },
      { id: 'SK23.05', name: 'Read pictograph', observable: true },
      { id: 'SK23.06', name: 'Read bar graph', observable: true },
      { id: 'SK23.07', name: 'Compare data', observable: true },
      { id: 'SK23.08', name: 'Interpret data', observable: false },
    ]},
  { id: 'SK24', name: 'Mathematical Reasoning & Problem Solving', domain: 'Cross-cutting',
    definition: 'Applying mathematics to situations across strands.',
    subskills: [
      { id: 'SK24.01', name: 'Identify relevant information', observable: false },
      { id: 'SK24.02', name: 'Choose an operation', observable: true },
      { id: 'SK24.03', name: 'Represent a problem', observable: false },
      { id: 'SK24.04', name: 'Explain reasoning', observable: false },
      { id: 'SK24.05', name: 'Check an answer', observable: false },
      { id: 'SK24.06', name: 'Apply mathematics to daily life', observable: true },
      { id: 'SK24.07', name: 'Solve multi-step problems', observable: true },
    ]},
];

// ─────────────────────────────────────────────────────────────────────────────
// 93 Levels (Spec §4): levelId, capability, primary skills, supporting skills.
// Stage is derived from levelNumber so it matches RoleDashboards.tsx.
// ─────────────────────────────────────────────────────────────────────────────

export interface LevelSkillMapping {
  levelId: string;
  levelNumber: number;
  /**
   * The same level's identifier in the research docs' S-notation
   * (`Research/fln_level_networks.md`, `Research/fln_proposed_levels.md`),
   * e.g. "S3.5". Derived, not hand-maintained — see sCodeFor() below.
   * Issue #280: this is the "make the mapping available to the code" ask.
   * Which notation is canonical long-term is a separate, deliberate naming
   * decision (issue #280 ask #3) that hasn't been made — both IDs coexist
   * here so nothing has to be renamed (and no student-response history
   * orphaned) before that decision happens.
   */
  sCode: string;
  capability: string;
  stage: 'Pre-school 1' | 'Pre-school 2' | 'Pre-school 3'
       | 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4';
  primarySkills: string[];     // SK IDs
  supportingSkills: string[];  // SK IDs
  prerequisites: Prerequisite[];
  questionTypes: string[];
  evidence: string[];
}

/**
 * Issue #277: a level's prerequisites can genuinely differ in strength from
 * each other (e.g. L53 depends on L36 more loosely than it depends on L37) —
 * the relationship type lives on the edge, not on the whole level, so mixed
 * strength can actually be expressed. `rationale` gives somewhere to record
 * *why* an edge is typed the way it is; per the issue, an edge with no
 * stated rationale shouldn't be typed as a hard prerequisite
 * (`required_for_procedure`) — the diagnostic paper's apex-selection
 * inference only holds across genuinely hard edges, so an unjustified one
 * silently over-claims what testing the apex level actually proves.
 */
export interface Prerequisite {
  levelId: string;
  relationshipType: RelationshipType;
  rationale?: string;
}

// Cumulative level counts per S-notation stage (S1..S7): 7, 10, 10, 15, 19,
// 14, 18 — sums to 93. Both stageFor() and sCodeFor() derive from this same
// array so the two notations can't drift relative to each other by
// construction. Verified to reproduce all 93 rows of
// Research/fln_L_to_S_crosswalk.json exactly — see
// scripts/check-level-notation-drift.ts.
const STAGE_CUMULATIVE_BOUNDARIES = [7, 17, 27, 42, 61, 75, 93] as const;

function stageIndexFor(n: number): number {
  for (let i = 0; i < STAGE_CUMULATIVE_BOUNDARIES.length; i++) {
    if (n <= STAGE_CUMULATIVE_BOUNDARIES[i]) return i + 1; // 1-indexed: S1..S7
  }
  throw new Error(`Level ${n} is outside the 93-level range (1-93).`);
}

/** The n-th S-code in stage-then-index order, e.g. sCodeFor(28) === "S4.1". */
function sCodeFor(n: number): string {
  const stageIdx = stageIndexFor(n);
  const prevBoundary = stageIdx === 1 ? 0 : STAGE_CUMULATIVE_BOUNDARIES[stageIdx - 2];
  const withinStageIdx = n - prevBoundary;
  return `S${stageIdx}.${withinStageIdx}`;
}

function stageFor(n: number): LevelSkillMapping['stage'] {
  const names: LevelSkillMapping['stage'][] = [
    'Pre-school 1', 'Pre-school 2', 'Pre-school 3',
    'Class 1', 'Class 2', 'Class 3', 'Class 4',
  ];
  return names[stageIndexFor(n) - 1];
}

// Format helpers for evidence/question types — kept inline so we don't drift
// away from what the spec actually says at each level.
function qtL(l: number): string[] {
  // Reasonable default question types inferred from capability term.
  // Kept short — the spec is the source of truth for question-type authoring.
  return [`sample L${l} question (capability per spec §4)`];
}

// ── 27 pre-school levels: derived from the canonical spec §4 table ────────────
// (Earlier hand-written L1-L27 mapping has been replaced by spec §4. The shape
// and the dashboard button location are preserved.)

// Issue #277: every existing call site below sets `prerequisites` as a plain
// levelId array plus one shared `relationshipType` — because until now that
// was the only way to say it. That shape stays valid as a shorthand (most
// levels genuinely do have uniform-strength prerequisites and there's no
// reason to force verbosity where it isn't needed) but is normalized here
// into real per-edge Prerequisite objects, so the *data* is per-edge even
// where the *authoring* isn't. A call site that does need mixed strength
// (e.g. applying #278's corrections) can pass `Prerequisite[]` directly
// instead, per-edge, bypassing the shorthand for just that level.
function normalizePrerequisites(
  prereqs: (string | Prerequisite)[] | undefined,
  defaultType: RelationshipType
): Prerequisite[] {
  return (prereqs ?? []).map(p =>
    typeof p === 'string' ? { levelId: p, relationshipType: defaultType } : p
  );
}

function makeLevel(n: number, capability: string, primary: string[], supporting: string[], opts: {
  prerequisites?: (string | Prerequisite)[];
  relationshipType?: RelationshipType;
  questionTypes?: string[];
  evidence?: string[];
} = {}): LevelSkillMapping {
  return {
    levelId: `L${n}`,
    levelNumber: n,
    sCode: sCodeFor(n),
    capability,
    stage: stageFor(n),
    primarySkills: primary,
    supportingSkills: supporting,
    prerequisites: normalizePrerequisites(opts.prerequisites, opts.relationshipType ?? 'often_precedes'),
    questionTypes: opts.questionTypes ?? qtL(n),
    evidence: opts.evidence ?? [],
  };
}

export const LEVEL_SKILL_MAP: LevelSkillMapping[] = [
  // ── Pre-school 1 (L1-L7) ───────────────────────────────────────────────────
  makeLevel(1,  'One-to-One Correspondence',              ['SK01'], ['SK06'],
    { evidence: ['one_to_one_correct', 'one_to_one_missed_match'] }),
  makeLevel(2,  'Classification (Single Property)',     ['SK02'], ['SK04'],
    { prerequisites: ['L1'], relationshipType: 'supports',
    evidence: ['classify_correct', 'odd_object_chosen'] }),
  makeLevel(3,  'Perceptual Same/Different',            ['SK04'], ['SK02'],
    { prerequisites: ['L1'], relationshipType: 'supports',
    evidence: ['same_different_correct'] }),
  makeLevel(4,  'Rote Verbal Counting to 10',           ['SK05'], ['SK10'],
    { prerequisites: ['L3'], relationshipType: 'often_precedes',
    evidence: ['rote_count_to_10'] }),
  makeLevel(5,  'Counting Small Sets (1-3)',             ['SK05','SK06'], ['SK01'],
    { prerequisites: ['L4'], relationshipType: 'required_for_procedure',
    evidence: ['cardinality_known', 'count_to_3'] }),
  makeLevel(6,  'Shape Matching (Perceptual)',          ['SK19'], ['SK04'],
    { prerequisites: ['L2'], relationshipType: 'supports',
    evidence: ['shape_match_accuracy'] }),
  makeLevel(7,  'Perceptual Subitizing',                ['SK07'], ['SK06'],
    { prerequisites: ['L4','L5'], relationshipType: 'supports',
    evidence: ['subitize_1_3'] }),

  // ── Pre-school 2 (L8-L17) ──────────────────────────────────────────────────
  makeLevel(8,  'Quantity Comparison',                  ['SK09'], ['SK01','SK06'],
    { prerequisites: [{ levelId: 'L1', relationshipType: 'required_for_procedure',
      rationale: 'Pairwise matching is how a child judges more/less before counting' }],
    evidence: ['more_less_correct','equality_identified'] }),
  makeLevel(9,  'Seriation (3 Objects)',                ['SK03'], ['SK09'],
    { prerequisites: [{ levelId: 'L8', relationshipType: 'required_for_procedure',
      rationale: 'Seriation requires repeated pairwise comparison' }],
    evidence: ['seriate_3'] }),
  makeLevel(10, 'Classification (Increasing Complexity)', ['SK02'], ['SK04'],
    { prerequisites: ['L2'], relationshipType: 'supports',
    evidence: ['multi_property_classify'] }),
  makeLevel(11, 'Counting to 5 (Cardinality)',          ['SK05','SK06'], ['SK01'],
    { prerequisites: ['L5'], relationshipType: 'required_for_procedure',
    evidence: ['cardinality_to_5'] }),
  makeLevel(12, 'Counting 6-10',                        ['SK05'], ['SK06'],
    { prerequisites: ['L11'], relationshipType: 'often_precedes',
    evidence: ['count_to_10'] }),
  makeLevel(13, 'Shape Identification',                 ['SK19'], ['SK04'],
    { prerequisites: ['L6'], relationshipType: 'supports',
    evidence: ['shape_id_correct'] }),
  makeLevel(14, '2-Item Patterns',                      ['SK18'], ['SK04'],
    { prerequisites: ['L10'], relationshipType: 'often_precedes',
    evidence: ['ab_pattern_extend'] }),
  makeLevel(15, 'Comparative Vocabulary',               ['SK20'], ['SK09'],
    { prerequisites: ['L8'], relationshipType: 'supports',
    evidence: ['compare_vocab_correct'] }),
  makeLevel(16, 'Conceptual Subitizing',                ['SK07'], ['SK06','SK12'],
    { prerequisites: [
      { levelId: 'L7', relationshipType: 'required_for_procedure',
        rationale: 'Clements & Sarama: perceptual subitizing precedes conceptual' },
      { levelId: 'L11', relationshipType: 'supports' }],
    evidence: ['conceptual_subitize'] }),
  makeLevel(17, 'Basic Shape Composition',              ['SK19'], ['SK12'],
    { prerequisites: ['L13'], relationshipType: 'supports',
    evidence: ['compose_shape'] }),

  // ── Pre-school 3 (L18-L27) ─────────────────────────────────────────────────
  makeLevel(18, 'Numeral Recognition (1-10)',           ['SK08'], ['SK05'],
    { prerequisites: ['L4'], relationshipType: 'often_precedes',
    evidence: ['numeral_id_1_10'] }),
  makeLevel(19, 'Numeral-Quantity Correspondence',      ['SK08','SK06'], ['SK05'],
    { prerequisites: [
      { levelId: 'L11', relationshipType: 'required_for_procedure',
        rationale: 'Numeral-quantity correspondence requires the cardinality principle (last count = total), established at counting-to-5' },
      { levelId: 'L18', relationshipType: 'required_for_procedure' }],
    evidence: ['numeral_quantity_match'] }),
  makeLevel(20, 'Numeral Comparison (Object-Mediated)', ['SK09'], ['SK08'],
    { prerequisites: ['L19'], relationshipType: 'often_precedes',
    evidence: ['numeral_compare_correct'] }),
  makeLevel(21, 'Seriation with Transitivity',          ['SK03'], ['SK09'],
    { prerequisites: [{ levelId: 'L9', relationshipType: 'required_for_procedure',
      rationale: "Piaget's own documented refinement of basic seriation" }],
    evidence: ['transitive_seriation'] }),
  makeLevel(22, 'Flexible Classification',              ['SK02'], ['SK04','SK24'],
    { prerequisites: [{ levelId: 'L10', relationshipType: 'required_for_procedure',
      rationale: 'Flexible re-sorting refines increasing-complexity classification' }],
    evidence: ['flexible_classify'] }),
  makeLevel(23, 'Numeral Sequencing',                   ['SK10'], ['SK05','SK08'],
    { prerequisites: [{ levelId: 'L18', relationshipType: 'required_for_procedure',
      rationale: "Cannot sequence numeral symbols that aren't yet recognized" }],
    evidence: ['sequence_complete'] }),
  makeLevel(24, 'Comparative Vocabulary (Formalizing)', ['SK20'], ['SK09'],
    { prerequisites: ['L15'], relationshipType: 'supports',
    evidence: ['formal_compare_vocab'] }),
  makeLevel(25, 'Patterns (2-Item Indep & 3-Item Intro)', ['SK18'], ['SK04'],
    { prerequisites: ['L14'], relationshipType: 'often_precedes',
    evidence: ['three_item_pattern_extend'] }),
  makeLevel(26, 'Basic Shape Properties',               ['SK19'], ['SK04'],
    { prerequisites: ['L13'], relationshipType: 'supports',
    evidence: ['shape_property_id'] }),
  makeLevel(27, 'Shape Composition & Decomposition',    ['SK19'], ['SK12'],
    { prerequisites: [{ levelId: 'L17', relationshipType: 'required_for_procedure',
      rationale: 'Clements et al. 2019: Picture Maker builds on Piece Assembler' }],
    evidence: ['shape_compose_decompose'] }),

  // ── Class 1 (L28-L42) ─────────────────────────────────────────────────────
  makeLevel(28, 'Abstract Numeral Comparison',          ['SK09'], ['SK08','SK10'],
    { prerequisites: [{ levelId: 'L20', relationshipType: 'required_for_procedure',
      rationale: 'Object-mediated comparison is the direct predecessor of abstract comparison' }] }),
  makeLevel(29, 'Close Numeral Comparison',             ['SK09'], ['SK11'],
    { prerequisites: ['L28'], relationshipType: 'often_precedes' }),
  makeLevel(30, 'Counting Objects to 20',               ['SK05','SK06'], ['SK01'],
    { prerequisites: [
      { levelId: 'L11', relationshipType: 'required_for_procedure',
        rationale: 'Counting 20 objects requires the cardinality principle already established by counting to 5' },
      { levelId: 'L12', relationshipType: 'required_for_procedure',
        rationale: 'Counting to 20 is a direct fluency extension of counting 6-10' }] }),
  makeLevel(31, 'Reading & Writing Numerals to 99',     ['SK08'], ['SK05','SK11'],
    { prerequisites: [
      { levelId: 'L18', relationshipType: 'required_for_procedure',
        rationale: 'Cannot read/write 2-digit numerals without recognizing the constituent digits' },
      { levelId: 'L23', relationshipType: 'required_for_procedure',
        rationale: 'Ordering single-digit numerals is the direct precursor to ordering/writing 2-digit ones' }] }),
  makeLevel(32, 'Tens and Ones',                        ['SK11'], ['SK12'],
    { prerequisites: ['L31'], relationshipType: 'required_for_procedure' }),
  makeLevel(33, 'Single-Digit Addition',                ['SK13'], ['SK05','SK06','SK12'],
    { prerequisites: [{ levelId: 'L32', relationshipType: 'often_precedes',
      rationale: "Demoted from required_for_procedure (issue #279): single-digit addition doesn't require place-value (tens/ones) understanding at all — it's typically taught with counting/manipulatives before place value. Curricular ordering only, no hard dependency." }] }),
  makeLevel(34, 'Single-Digit Subtraction',             ['SK14'], ['SK05','SK06'],
    { prerequisites: ['L33'], relationshipType: 'required_for_procedure' }),
  makeLevel(35, '3D Shape Properties',                  ['SK19'], ['SK04'],
    { prerequisites: ['L26'], relationshipType: 'supports' }),
  makeLevel(36, 'Non-Standard Length Estimation',       ['SK20'], ['SK24'],
    { prerequisites: ['L24'], relationshipType: 'supports' }),
  makeLevel(37, 'Non-Standard Capacity Estimation',     ['SK20'], ['SK24'],
    { prerequisites: ['L36'], relationshipType: 'supports' }),
  makeLevel(38, '3-Item Pattern Completion',            ['SK18'], ['SK04'],
    { prerequisites: ['L25'], relationshipType: 'often_precedes' }),
  makeLevel(39, 'Concept of Zero',                      ['SK08'], ['SK05','SK11'],
    { prerequisites: ['L18'], relationshipType: 'often_precedes' }),
  makeLevel(40, 'Ordinal Positions (1st-10th)',         ['SK10'], ['SK05'],
    { prerequisites: [{ levelId: 'L23', relationshipType: 'required_for_procedure',
      rationale: 'Ordinal position builds on the general ability to order things' }] }),
  makeLevel(41, 'Informal Number Line (0-20)',          ['SK10'], ['SK09'],
    { prerequisites: ['L30'], relationshipType: 'often_precedes' }),
  makeLevel(42, 'Advanced Shape Composition',           ['SK19'], ['SK12'],
    { prerequisites: [{ levelId: 'L27', relationshipType: 'required_for_procedure',
      rationale: 'Same trajectory: Shape Composer follows Picture Maker' }] }),

  // ── Class 2 (L43-L61) ─────────────────────────────────────────────────────
  makeLevel(43, 'Reading & Writing 3-Digit Numbers',    ['SK08'], ['SK11'],
    { prerequisites: [{ levelId: 'L31', relationshipType: 'required_for_procedure',
      rationale: 'Direct range extension of reading/writing to 99 — same underlying skill' }] }),
  makeLevel(44, 'Tens as Bundles/Groups',               ['SK11'], ['SK12'],
    { prerequisites: ['L32'], relationshipType: 'often_precedes' }),
  makeLevel(45, 'Flexible 2-Digit Decomposition',       ['SK12'], ['SK11'],
    { prerequisites: [
      { levelId: 'L32', relationshipType: 'required_for_procedure',
        rationale: 'Flexible 2-digit decomposition directly builds on the tens/ones grouping concept' },
      { levelId: 'L44', relationshipType: 'required_for_procedure' }] }),
  makeLevel(46, '2-Digit Addition with Regrouping',     ['SK13','SK11'], ['SK12'],
    { prerequisites: [
      { levelId: 'L33', relationshipType: 'required_for_procedure' },
      { levelId: 'L45', relationshipType: 'required_for_procedure',
        rationale: "Can't regroup without decomposition" }] }),
  makeLevel(47, '2-Digit Subtraction with Regrouping',  ['SK14','SK11'], ['SK12'],
    { prerequisites: [
      { levelId: 'L34', relationshipType: 'required_for_procedure' },
      { levelId: 'L45', relationshipType: 'required_for_procedure',
        rationale: "Can't regroup without decomposition (same as the addition case)" }] }),
  makeLevel(48, 'Multiplication as Repeated Addition',  ['SK15'], ['SK13','SK18'],
    { prerequisites: ['L33','L61'], relationshipType: 'often_precedes' }),
  makeLevel(49, 'Division as Equal Sharing',            ['SK16'], ['SK01','SK06'],
    { prerequisites: ['L33'], relationshipType: 'often_precedes' }),
  makeLevel(50, 'Multiplication Tables (2,3,4,5,10)',   ['SK15'], ['SK18'],
    { prerequisites: ['L48'], relationshipType: 'required_for_procedure' }),
  makeLevel(51, 'Currency Recognition',                 ['SK22'], ['SK08'],
    { prerequisites: ['L43'], relationshipType: 'often_precedes' }),
  makeLevel(52, 'Informal Fractions (Folding)',         ['SK17'], ['SK19'],
    { prerequisites: ['L42'], relationshipType: 'supports' }),
  makeLevel(53, 'Uniform Non-Standard Measurement',     ['SK20'], ['SK24'],
    { prerequisites: ['L36','L37'], relationshipType: 'supports' }),
  makeLevel(54, '2D Shape Set Identification',          ['SK19'], ['SK02'],
    { prerequisites: ['L26','L42'], relationshipType: 'supports' }),
  makeLevel(55, 'Spatial Vocabulary',                   ['SK19'], ['SK24'],
    { prerequisites: ['L35'], relationshipType: 'supports' }),
  makeLevel(56, 'Calendar Reading',                     ['SK21'], ['SK10'],
    { prerequisites: ['L40'], relationshipType: 'often_precedes' }),
  makeLevel(57, 'Data Handling (Sorting & Tallies)',    ['SK23'], ['SK02','SK05'],
    { prerequisites: ['L22'], relationshipType: 'supports' }),
  makeLevel(58, 'Number Patterns & Sequences',          ['SK18'], ['SK10'],
    { prerequisites: ['L23','L41'], relationshipType: 'often_precedes' }),
  makeLevel(59, 'Zero as a Placeholder',                ['SK11'], ['SK08'],
    { prerequisites: [{ levelId: 'L43', relationshipType: 'required_for_procedure',
      rationale: "Recognizing zero's placeholding role (e.g. in 205) presupposes being able to read/write 3-digit numbers generally" }] }),
  makeLevel(60, 'Extended Number Line (0-100)',         ['SK10'], ['SK09','SK11'],
    { prerequisites: ['L41','L44'], relationshipType: 'often_precedes' }),
  makeLevel(61, 'Skip Counting (2s, 5s, 10s)',          ['SK18','SK15'], ['SK05'],
    { prerequisites: [
      { levelId: 'L12', relationshipType: 'often_precedes' },
      { levelId: 'L58', relationshipType: 'required_for_procedure',
        rationale: 'Skip-counting is a constant-interval number pattern' }] }),

  // ── Class 3 (L62-L75) ─────────────────────────────────────────────────────
  makeLevel(62, '3-Digit Place Value & Expanded Form',  ['SK11'], ['SK12'],
    { prerequisites: [
      { levelId: 'L45', relationshipType: 'required_for_procedure' },
      { levelId: 'L59', relationshipType: 'required_for_procedure',
        rationale: 'Expanded form (e.g. 305 = 300+0+5) requires zero-as-placeholder already in place' }] }),
  makeLevel(63, 'Flexible 3-Digit Decomposition',       ['SK12'], ['SK11'],
    { prerequisites: [
      { levelId: 'L45', relationshipType: 'required_for_procedure',
        rationale: '3-digit decomposition is the range extension of 2-digit decomposition' },
      { levelId: 'L62', relationshipType: 'required_for_procedure' }] }),
  makeLevel(64, '3-Digit Comparison & Ordering',        ['SK09','SK03'], ['SK11'],
    { prerequisites: [
      { levelId: 'L29', relationshipType: 'required_for_procedure',
        rationale: 'Class-1 abstract comparison is prerequisite for Class-3 3-digit comparison' },
      { levelId: 'L62', relationshipType: 'often_precedes' }] }),
  makeLevel(65, 'Reading & Writing 4-Digit Numbers',    ['SK08'], ['SK11'],
    { prerequisites: [
      { levelId: 'L59', relationshipType: 'required_for_procedure',
        rationale: '4-digit numbers with internal zeros (e.g. 4008) need the same placeholder concept established at 3 digits' },
      { levelId: 'L62', relationshipType: 'required_for_procedure',
        rationale: 'Place-value range extension from 3 to 4 digits' }] }),
  makeLevel(66, '3-Digit Addition & Subtraction Problems', ['SK13','SK14'], ['SK11','SK12'],
    { prerequisites: ['L46','L47','L62'], relationshipType: 'required_for_procedure' }),
  makeLevel(67, 'Full Multiplication Tables (2-10)',   ['SK15'], ['SK18'],
    { prerequisites: [
      { levelId: 'L50', relationshipType: 'required_for_procedure' },
      { levelId: 'L61', relationshipType: 'required_for_procedure',
        rationale: 'Skip-counting is the standard precursor to multiplication-table fluency (same logic as the L58→L61 edge in #278)' }] }),
  makeLevel(68, 'Division Facts & Inverse Relation',    ['SK16'], ['SK15'],
    { prerequisites: ['L67'], relationshipType: 'required_for_procedure' }),
  makeLevel(69, 'Standard Measurement Units',           ['SK20'], ['SK24'],
    { prerequisites: ['L53'], relationshipType: 'required_for_procedure' }),
  makeLevel(70, 'Relating 2D Faces to 3D Solids',       ['SK19'], ['SK04'],
    { prerequisites: [
      { levelId: 'L35', relationshipType: 'required_for_procedure',
        rationale: 'Van Hiele L1→L2: composing needs property vocabulary first' },
      { levelId: 'L54', relationshipType: 'supports' }] }),
  makeLevel(71, 'Telling Time (Hours & Half-Hours)',    ['SK21'], ['SK10'],
    { prerequisites: ['L56'], relationshipType: 'required_for_procedure' }),
  makeLevel(72, 'Money Arithmetic',                     ['SK22'], ['SK13','SK14'],
    { prerequisites: [
      { levelId: 'L51', relationshipType: 'required_for_procedure' },
      { levelId: 'L66', relationshipType: 'often_precedes',
        rationale: 'Demoted from required_for_procedure (issue #279): money arithmetic can stay within 2-digit amounts — 3-digit add/sub fluency is common but not a hard gate on it.' }] }),
  makeLevel(73, 'Formal Fractions (Half/Quarter)',      ['SK17'], ['SK12'],
    { prerequisites: ['L52'], relationshipType: 'required_for_procedure' }),
  makeLevel(74, 'Pattern Rules & Generalization',       ['SK18'], ['SK24'],
    { prerequisites: ['L58','L67'], relationshipType: 'often_precedes' }),
  makeLevel(75, 'Data Handling (Pictographs & Bar Graphs)', ['SK23'], ['SK05','SK09'],
    { prerequisites: ['L57'], relationshipType: 'required_for_procedure' }),

  // ── Class 4 (L76-L93) ─────────────────────────────────────────────────────
  makeLevel(76, '4-Digit & 5-Digit Place Value',        ['SK11'], ['SK12'],
    { prerequisites: [
      { levelId: 'L62', relationshipType: 'required_for_procedure',
        rationale: 'Place-value range extension from 3 digits to 4/5 digits' },
      { levelId: 'L65', relationshipType: 'required_for_procedure' }] }),
  makeLevel(77, 'Large Number Operations & Regrouping', ['SK13','SK14','SK11'], ['SK12'],
    { prerequisites: [
      { levelId: 'L66', relationshipType: 'required_for_procedure',
        rationale: '3-digit regrouping is foundational to large-number regrouping' },
      { levelId: 'L76', relationshipType: 'required_for_procedure' }] }),
  makeLevel(78, 'Complex Multi-Digit Word Problems',     ['SK24','SK13','SK14'], ['SK11','SK12'],
    { prerequisites: ['L77'], relationshipType: 'often_precedes' }),
  makeLevel(79, 'Extended Multiplication',              ['SK15'], ['SK11','SK12'],
    { prerequisites: [
      { levelId: 'L50', relationshipType: 'required_for_procedure',
        rationale: 'Extended multiplication requires basic multiplication-table fluency' },
      { levelId: 'L67', relationshipType: 'required_for_procedure',
        rationale: 'Same as L50 — parallel prerequisite via the fuller table set' },
      { levelId: 'L76', relationshipType: 'required_for_procedure',
        rationale: 'Multi-digit multiplication requires place-value alignment for partial products' }] }),
  makeLevel(80, 'Formal Long Division',                 ['SK16'], ['SK15','SK11'],
    { prerequisites: [
      { levelId: 'L68', relationshipType: 'required_for_procedure',
        rationale: 'Long division requires division-fact fluency' },
      { levelId: 'L76', relationshipType: 'required_for_procedure',
        rationale: 'Long division of large numbers needs the same place-value grounding' }] }),
  makeLevel(81, 'Fractional Notation & Equivalence',    ['SK17'], ['SK12'],
    { prerequisites: ['L73'], relationshipType: 'required_for_procedure' }),
  makeLevel(82, 'Standard Unit Conversion',             ['SK20'], ['SK12'],
    { prerequisites: ['L69'], relationshipType: 'required_for_procedure' }),
  makeLevel(83, 'Applied Measurement Word Problems',    ['SK20','SK24'], ['SK13','SK14'],
    { prerequisites: ['L78','L82'], relationshipType: 'often_precedes' }),
  makeLevel(84, '3D Nets & Spatial Perspective',        ['SK19'], ['SK12','SK24'],
    { prerequisites: [{ levelId: 'L70', relationshipType: 'required_for_procedure',
      rationale: 'Van Hiele L2 extended: nets need the same part-whole reasoning' }] }),
  makeLevel(85, 'Advanced Time Calculation',            ['SK21'], ['SK13','SK14'],
    { prerequisites: ['L71'], relationshipType: 'required_for_procedure' }),
  makeLevel(86, 'Complex Money Problems',                ['SK22','SK24'], ['SK13','SK14'],
    { prerequisites: ['L72'], relationshipType: 'often_precedes' }),
  makeLevel(87, 'Advanced Number Patterns',             ['SK18'], ['SK10','SK24'],
    { prerequisites: ['L74'], relationshipType: 'often_precedes' }),
  makeLevel(88, 'Bar Graphs & Data Interpretation',     ['SK23'], ['SK09','SK24'],
    { prerequisites: ['L75'], relationshipType: 'often_precedes' }),
  makeLevel(89, 'Factors & Multiples',                  ['SK15','SK18'], ['SK16'],
    { prerequisites: [
      { levelId: 'L67', relationshipType: 'required_for_procedure',
        rationale: 'Cannot reliably find factors of 24 without knowing what multiplies to 24' },
      { levelId: 'L68', relationshipType: 'often_precedes' }] }),
  makeLevel(90, 'Decimals (Tenths & Hundredths)',       ['SK08','SK17'], ['SK11','SK12'],
    { prerequisites: [
      { levelId: 'L63', relationshipType: 'supports',
        rationale: "Demoted from required_for_procedure on review: L90's objective is reading/writing/comparing tenths and hundredths, which does not require flexibly decomposing 3-digit whole numbers. Curricula (Common Core, NCERT) introduce decimals as an extension of fraction notation (L81), not whole-number decomposition. A whole-number place-value link exists but is closer to L62 (3-digit place value/expanded form) than to L63 specifically." },
      { levelId: 'L81', relationshipType: 'required_for_procedure',
        rationale: 'Decimals are standardly introduced as an extension of fraction notation' }] }),
  makeLevel(91, 'Angles & Turn',                        ['SK19'], ['SK10'],
    { prerequisites: ['L55'], relationshipType: 'supports' }),
  makeLevel(92, 'Symmetry & Reflection',                ['SK19'], ['SK18'],
    { prerequisites: ['L74'], relationshipType: 'supports' }),
  makeLevel(93, 'Perimeter & Area',                     ['SK20'], ['SK19','SK13'],
    { prerequisites: [{ levelId: 'L82', relationshipType: 'often_precedes',
      rationale: "Demoted from required_for_procedure (issue #279): perimeter/area computation is fundamentally addition/multiplication over given measurements — unit conversion is only needed for the subset of problems with mixed units, not the core skill." }] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_BY_ID: Record<string, CoreSkill> = Object.fromEntries(CORE_SKILLS.map(s => [s.id, s]));
const LEVEL_BY_ID: Record<string, LevelSkillMapping> = Object.fromEntries(LEVEL_SKILL_MAP.map(l => [l.levelId, l]));
const LEVEL_BY_SCODE: Record<string, LevelSkillMapping> = Object.fromEntries(LEVEL_SKILL_MAP.map(l => [l.sCode, l]));

(function sanity(): void {
  for (const lvl of LEVEL_SKILL_MAP) {
    for (const sid of [...lvl.primarySkills, ...lvl.supportingSkills]) {
      if (!SKILL_BY_ID[sid]) {
        throw new Error(`Level ${lvl.levelId} references unknown skill ${sid}`);
      }
    }
    for (const pre of lvl.prerequisites) {
      if (!LEVEL_BY_ID[pre.levelId]) {
        throw new Error(`Level ${lvl.levelId} references unknown prereq level ${pre.levelId}`);
      }
    }
  }
  if (LEVEL_SKILL_MAP.length !== 93) {
    throw new Error(`Expected 93 levels, got ${LEVEL_SKILL_MAP.length}`);
  }
  if (Object.keys(SKILL_BY_ID).length !== 24) {
    throw new Error(`Expected 24 core skills, got ${Object.keys(SKILL_BY_ID).length}`);
  }
  if (Object.keys(LEVEL_BY_SCODE).length !== 93) {
    throw new Error(`Expected 93 unique sCode values, got ${Object.keys(LEVEL_BY_SCODE).length} — a level's sCode collided with another's.`);
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// Derived aggregates
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a level by its S-notation code (e.g. "S4.1") instead of its
 * L-number. See LevelSkillMapping.sCode and issue #280. */
export function getLevelBySCode(sCode: string): LevelSkillMapping | undefined {
  return LEVEL_BY_SCODE[sCode];
}

export function getSkillsForLevel(levelId: string): CoreSkill[] {
  const lvl = LEVEL_BY_ID[levelId];
  if (!lvl) return [];
  return [...lvl.primarySkills, ...lvl.supportingSkills]
    .map(s => SKILL_BY_ID[s])
    .filter((x, i, a) => x && a.indexOf(x) === i);
}

export function getLevelsForSkill(skillId: string): LevelSkillMapping[] {
  return LEVEL_SKILL_MAP.filter(l =>
    l.primarySkills.includes(skillId) || l.supportingSkills.includes(skillId)
  );
}

export function getCoverageMatrix(): Record<string, Set<string>> {
  const m: Record<string, Set<string>> = {};
  for (const lvl of LEVEL_SKILL_MAP) {
    for (const sid of [...lvl.primarySkills, ...lvl.supportingSkills]) {
      (m[sid] ||= new Set()).add(lvl.levelId);
    }
  }
  return m;
}

export function getPrerequisiteEdges(): Array<{ from: string; to: string; type: RelationshipType }> {
  const edges: Array<{ from: string; to: string; type: RelationshipType }> = [];
  for (const lvl of LEVEL_SKILL_MAP) {
    for (const pre of lvl.prerequisites) {
      edges.push({ from: pre.levelId, to: lvl.levelId, type: pre.relationshipType });
    }
  }
  return edges;
}

export function getSubSkillsForLevel(levelId: string): Subskill[] {
  const skills = getSkillsForLevel(levelId);
  const out: Subskill[] = [];
  for (const sk of skills) out.push(...sk.subskills);
  return out;
}

// Strand tint per core skill domain (Tailwind classes)
export const DOMAIN_TINT: Record<SkillDomain, string> = {
  'Pre-number':         'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Number Sense':       'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  'Number Operations':  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  'Fractions':          'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Patterns':           'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  'Shapes & Spatial':   'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  'Measurement':        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Calendar & Time':    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Money':              'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  'Data':               'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Cross-cutting':      'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

// Map a level's stage to its tint label
export const STAGE_TINT: Record<LevelSkillMapping['stage'], string> = {
  'Pre-school 1': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Pre-school 2': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Pre-school 3': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Class 1':      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Class 2':      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Class 3':      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Class 4':      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// Suppress unused warnings for legacy imports
export type { SkillDomain as _SkillDomain, RelationshipType as _RelationshipType };
