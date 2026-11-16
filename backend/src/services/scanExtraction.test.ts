import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRequiresReview } from './scanExtraction';

describe('computeRequiresReview', () => {
  it('flags blank answers for teacher review', () => {
    assert.equal(computeRequiresReview(''), true);
    assert.equal(computeRequiresReview('   '), true);
  });

  it('flags ambiguous answers for teacher review', () => {
    assert.equal(computeRequiresReview('unclear'), true);
    assert.equal(computeRequiresReview('unreadable text'), true);
    assert.equal(computeRequiresReview('could not extract answer'), true);
  });

  it('flags low-confidence answers', () => {
    assert.equal(computeRequiresReview('A', 0.4), true);
  });

  it('does not flag readable answers with sufficient confidence', () => {
    assert.equal(computeRequiresReview('A', 0.8), false);
  });
});
