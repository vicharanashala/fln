import assert from 'assert';
import { computeApexConcepts, validateConceptPrerequisites } from '../competencyPrerequisites';

// 1. Verify prerequisite graph invariants
const report = validateConceptPrerequisites();
assert.strictEqual(report.isValid, true, 'Prerequisite graph must be valid (no unknown concept IDs or cycles)');

// 2. Verify apex concepts computation
const st3Apex = computeApexConcepts(3);
assert.ok(st3Apex.length > 0, 'Stage 3 apex concepts should be non-empty');
assert.ok(st3Apex.includes('S3.10'), 'S3.10 should be included in Stage 3 apex nodes');
assert.ok(st3Apex.includes('S2.10') || st3Apex.includes('S3.10'), 'S2.10/S3.10 shape composition chain represented');

const allApex = computeApexConcepts();
assert.ok(allApex.length > 0, 'Full curriculum apex concepts should be non-empty');

console.log(`✓ Apex concepts check passed: Stage 3 apex count = ${st3Apex.length}, Total curriculum apex count = ${allApex.length}`);
