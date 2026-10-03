import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_TYPES } from '../src/types/questionTemplateParams.js';
import {
  getAnswerSpaceRule,
  getAllAnswerSpaceRules,
  generateAnswerSpaceCss,
} from '../src/worksheetRenderer.js';

test('ACCEPTANCE CRITERIA: A spacing/sizing rule exists per answerType defined in one place', () => {
  const rules = getAllAnswerSpaceRules();

  // All 6 ANSWER_TYPES must have defined rules
  for (const answerType of ANSWER_TYPES) {
    const rule = rules[answerType];
    assert.ok(rule, `Rule missing for answerType: ${answerType}`);
    assert.equal(rule.answerType, answerType);
    assert.ok(rule.boxWidthMm > 0, `boxWidthMm must be > 0 for ${answerType}`);
    assert.ok(rule.boxHeightMm > 0, `boxHeightMm must be > 0 for ${answerType}`);
    assert.ok(rule.minPaddingMm >= 0, `minPaddingMm must be >= 0 for ${answerType}`);
    assert.ok(rule.marginBottomMm > 0, `marginBottomMm must be > 0 for ${answerType}`);
    assert.ok(rule.cssClasses.length > 0, `cssClasses must not be empty for ${answerType}`);
    assert.ok(rule.styleDeclaration.length > 0, `styleDeclaration must not be empty for ${answerType}`);
  }
});

test('ACCEPTANCE CRITERIA: Visibly different, appropriately-sized answer space for different answerTypes', () => {
  const singleNumber = getAnswerSpaceRule('single-number');
  const mcq4 = getAnswerSpaceRule('mcq-4');
  const trace = getAnswerSpaceRule('trace');
  const matching = getAnswerSpaceRule('matching');

  // Verify dimensions are visibly different and appropriately sized
  assert.notEqual(singleNumber.boxWidthMm, trace.boxWidthMm);
  assert.notEqual(singleNumber.boxHeightMm, trace.boxHeightMm);
  assert.ok(trace.boxWidthMm > singleNumber.boxWidthMm, 'trace box width should be larger than single-number');
  assert.ok(trace.boxHeightMm > singleNumber.boxHeightMm, 'trace box height should be larger than single-number');

  assert.equal(singleNumber.layoutStyle, 'box');
  assert.equal(mcq4.layoutStyle, 'choice-grid');
  assert.equal(matching.layoutStyle, 'split-cols');
  assert.equal(trace.layoutStyle, 'large-area');
});

test('ACCEPTANCE CRITERIA: supportedAnswerShapes on SVG theme is consulted for circle-style answers', () => {
  // Theme with 'circle' in supportedAnswerShapes (e.g., 'mixed' or explicit 'circle')
  const baseRule = getAnswerSpaceRule('single-number');
  const circleRule = getAnswerSpaceRule('single-number', 'mixed');

  // SVG theme consulting 'circle' supportedAnswerShapes or 'circle' answerType
  assert.ok(circleRule.circlePaddingMm && circleRule.circlePaddingMm > 0, 'circlePaddingMm should be set');
  assert.ok(circleRule.minPaddingMm > baseRule.minPaddingMm, 'minPaddingMm should be larger for circle answers');
  assert.ok(circleRule.boxWidthMm > baseRule.boxWidthMm, 'boxWidthMm should expand for circle artwork area');
  assert.ok(circleRule.cssClasses.includes('ans-box-circle-target'), 'circle CSS class should be present');
});

test('generateAnswerSpaceCss produces valid CSS declarations for all answer types', () => {
  const css = generateAnswerSpaceCss();
  assert.ok(css.includes('.ans-box'), 'CSS should include .ans-box rules');
  assert.ok(css.includes('.ans-box-trace') || css.includes('.ans-box-single-number'), 'CSS should include specific answerType rules');
  assert.ok(css.includes('width:'), 'CSS should contain width property');
  assert.ok(css.includes('height:'), 'CSS should contain height property');
});
