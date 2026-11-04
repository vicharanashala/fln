import assert from 'node:assert';
import { bandFromScore, summariseConcept, BAND_RULE_VERSION, OBSERVATION_CODES } from './bands';

// Every score from 0 to 5 lands in exactly the reviewer's band.
const expected = ['Emerging', 'Emerging', 'Developing', 'Developing', 'Secure', 'Secure'];
expected.forEach((band, score) => assert.strictEqual(bandFromScore(score), band, `score ${score}`));

// Bad scores are refused, never silently clamped.
for (const bad of [-1, 6, 2.5, NaN, Infinity]) assert.throws(() => bandFromScore(bad), RangeError, `score ${bad}`);

// No marks is "Not yet assessed", not Emerging.
assert.deepStrictEqual(summariseConcept([]), { status: 'Not yet assessed', score: null, evidenceCount: 0, ruleVersion: null });

// Five marks.
assert.deepStrictEqual(summariseConcept([true, true, true, true, true]), { status: 'Secure', score: 5, evidenceCount: 5, ruleVersion: BAND_RULE_VERSION });
assert.strictEqual(summariseConcept([false, false, false, false, false]).status, 'Emerging');
assert.strictEqual(summariseConcept([true, false, true, false, false]).status, 'Developing');

// Fewer than five is a result that says how little evidence it has.
assert.strictEqual(summariseConcept([true, true]).evidenceCount, 2);
assert.throws(() => summariseConcept(new Array(6).fill(true)), RangeError, 'six marks refused');

assert.deepStrictEqual([...OBSERVATION_CODES], ['Independent', 'Prompted', 'Supported', 'Strategy']);
console.log('PASS  bands: 0-1 Emerging, 2-3 Developing, 4-5 Secure');
