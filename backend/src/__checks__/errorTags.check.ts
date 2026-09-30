import assert from 'assert';
import { TOPIC_ERROR_TAGS, getErrorTagsForTopic, isValidErrorTag } from '../errorTags';

console.log('Running errorTags checks...');

// 1. Verify Balvatika topic keys exist
assert.ok(TOPIC_ERROR_TAGS['counting'], 'counting topic should exist');
assert.ok(TOPIC_ERROR_TAGS['shapes'], 'shapes topic should exist');
assert.ok(TOPIC_ERROR_TAGS['patterns'], 'patterns topic should exist');
assert.ok(TOPIC_ERROR_TAGS['literacy'], 'literacy topic should exist');

// 2. Verify Gelman & Gallistel 5 counting principles
const countingTags = getErrorTagsForTopic('counting') as string[];
assert.strictEqual(countingTags.length, 5, 'counting should have 5 error tags');
assert.ok(countingTags.includes('one-to-one-slip'));
assert.ok(countingTags.includes('cardinality-miss'));

// 3. Verify shapes tags
const shapeTags = getErrorTagsForTopic('shapes') as string[];
assert.ok(shapeTags.includes('under-inclusion'));
assert.ok(shapeTags.includes('attribute-confusion'));

// 4. Verify tag validation helper
assert.strictEqual(isValidErrorTag('shapes', 'under-inclusion'), true);
assert.strictEqual(isValidErrorTag('shapes', 'non-existent-tag'), false);
assert.strictEqual(isValidErrorTag('invalid-topic', 'under-inclusion'), false);

console.log('✅ All errorTags checks passed successfully!');
