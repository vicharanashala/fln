import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ASSESSMENT_MODE_BY_CONCEPT,
    BALVATIKA_OUTCOMES,
    getAssessmentMode,
    AssessmentMode,
} from '../src/config/assessmentMode';
import { getLevelForConcept } from '../src/config/curriculumMap';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_MODES: Set<AssessmentMode> = new Set(['written', 'observed', 'both']);

test('1. Every key in ASSESSMENT_MODE_BY_CONCEPT is a valid S-code in CURRICULUM_MAPPING', () => {
    for (const conceptId of Object.keys(ASSESSMENT_MODE_BY_CONCEPT)) {
        const levelConfig = getLevelForConcept(conceptId);
        assert.ok(
            levelConfig !== undefined,
            `Concept '${conceptId}' in ASSESSMENT_MODE_BY_CONCEPT must exist in CURRICULUM_MAPPING`,
        );
        assert.equal(
            levelConfig.conceptId,
            conceptId,
            `Concept ID '${conceptId}' mapping mismatch in CURRICULUM_MAPPING`,
        );
    }
});

test('2. Every value in ASSESSMENT_MODE_BY_CONCEPT is one of written, observed, or both', () => {
    for (const [conceptId, mode] of Object.entries(ASSESSMENT_MODE_BY_CONCEPT)) {
        assert.ok(
            VALID_MODES.has(mode),
            `Concept '${conceptId}' has invalid AssessmentMode '${mode}'`,
        );
    }
});

test('3. Every core concept in competencyRequirements.seed.json with an assessmentMode matches getAssessmentMode', () => {
    const seedPath = path.resolve(__dirname, '../src/data/competencyRequirements.seed.json');
    assert.ok(fs.existsSync(seedPath), `Seed file not found at ${seedPath}`);

    const rawSeed = fs.readFileSync(seedPath, 'utf8');
    const seedRequirements = JSON.parse(rawSeed) as Array<Record<string, unknown>>;

    // When competencyRequirements are updated with conceptId and assessmentMode (Issue #844),
    // each core row must match the assessment mode registry.
    const seededWithMode = seedRequirements.filter(
        (row) => typeof row.conceptId === 'string' && typeof row.assessmentMode === 'string',
    );

    for (const row of seededWithMode) {
        const conceptId = row.conceptId as string;
        const expectedMode = row.assessmentMode as AssessmentMode;
        const actualMode = getAssessmentMode(conceptId);
        assert.equal(
            actualMode,
            expectedMode,
            `Seed row concept '${conceptId}' mode '${expectedMode}' does not match getAssessmentMode ('${actualMode}')`,
        );
    }
});

test('4. Balvatika counts for the 29 outcome nodes are 9 written, 9 both, 11 observed', () => {
    assert.equal(
        BALVATIKA_OUTCOMES.length,
        29,
        `Expected exactly 29 Balvatika outcome nodes, got ${BALVATIKA_OUTCOMES.length}`,
    );

    const counts: Record<AssessmentMode, number> = {
        written: 0,
        both: 0,
        observed: 0,
    };

    for (const outcome of BALVATIKA_OUTCOMES) {
        assert.ok(
            VALID_MODES.has(outcome.mode),
            `Outcome #${outcome.outcomeNumber} (${outcome.conceptId}) has invalid mode ${outcome.mode}`,
        );
        assert.ok(
            getLevelForConcept(outcome.conceptId) !== undefined,
            `Outcome #${outcome.outcomeNumber} concept '${outcome.conceptId}' must exist in CURRICULUM_MAPPING`,
        );
        counts[outcome.mode]++;
    }

    assert.equal(counts.written, 9, 'Expected exactly 9 written (Student) Balvatika outcomes');
    assert.equal(counts.both, 9, 'Expected exactly 9 both Balvatika outcomes');
    assert.equal(counts.observed, 11, 'Expected exactly 11 observed (Teacher) Balvatika outcomes');
});

test('Edge cases: getAssessmentMode returns correct mode or undefined for unknown concept', () => {
    assert.equal(getAssessmentMode('S3.2'), 'both');
    assert.equal(getAssessmentMode('S3.1'), 'written');
    assert.equal(getAssessmentMode('S4.9'), 'observed');
    assert.equal(getAssessmentMode('S999.999'), undefined);
    assert.equal(getAssessmentMode(''), undefined);
});
