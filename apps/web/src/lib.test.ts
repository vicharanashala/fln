import assert from 'node:assert';
import { describe, it } from 'node:test';
import { bandOf, firstChoice, firstTopic, parseOptions, parseSheetRef, sheetRefValue, latestByStudent, parseHash, parseNames, sameMarks, scoreOf, setLetter, svgDataUri } from './lib';
import type { Attempt } from './types';

describe('parseNames', () => {
  it('splits lines and commas, trims, collapses spaces, drops blanks and repeats', () => {
    assert.deepStrictEqual(parseNames('  Asha  Rao\nRavi,, meera\n\nasha rao ; Kabir'), ['Asha Rao', 'Ravi', 'meera', 'Kabir']);
  });
  it('returns nothing for empty input', () => {
    assert.deepStrictEqual(parseNames(''), []);
    assert.deepStrictEqual(parseNames(' \n , ; '), []);
  });
});

describe('bands match the server rule', () => {
  it('0-1 Emerging, 2-3 Developing, 4-5 Secure', () => {
    assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(bandOf), ['Emerging', 'Emerging', 'Developing', 'Developing', 'Secure', 'Secure']);
    assert.strictEqual(scoreOf([true, false, true, true, false]), 3);
  });
});

describe('latestByStudent', () => {
  it('keeps the first (newest) attempt per child', () => {
    const mk = (id: string, studentId: string): Attempt => ({ id, studentId, bankLevel: 22, levelNumber: null, set: 0, score: 1, band: 'Emerging', source: 'marks', createdAt: '', answers: [] });
    const m = latestByStudent([mk('new', 's1'), mk('other', 's2'), mk('old', 's1')]);
    assert.strictEqual(m.get('s1')?.id, 'new');
    assert.strictEqual(m.size, 2);
  });
});

describe('small helpers', () => {
  it('firstTopic picks the lowest bank number, or nothing for an empty list', () => {
    assert.strictEqual(firstTopic([{ bankLevel: 30, title: '', sets: 1 }, { bankLevel: 22, title: '', sets: 2 }])?.bankLevel, 22);
    assert.strictEqual(firstTopic([]), undefined);
  });
  it('sameMarks compares element by element', () => {
    assert.ok(sameMarks([true, false], [true, false]));
    assert.ok(!sameMarks([true, false], [true, true]));
    assert.ok(!sameMarks([true], [true, false]));
  });
  it('setLetter and parseHash', () => {
    assert.strictEqual(setLetter(0), 'A');
    assert.strictEqual(setLetter(3), 'D');
    assert.deepStrictEqual(parseHash('#/class/c1/print?topic=22&set=1').parts, ['class', 'c1', 'print']);
    assert.strictEqual(parseHash('#/class/c1/print?topic=22&set=1').query.get('set'), '1');
    assert.deepStrictEqual(parseHash('').parts, []);
  });
  it('svgDataUri keeps scripts inert by encoding the markup', () => {
    assert.ok(svgDataUri('<svg onload="x()"/>').startsWith('data:image/svg+xml'));
    assert.ok(!svgDataUri('<svg onload="x()"/>').includes('<'));
  });
});

describe('sheet choices', () => {
  it('parses and writes a sheet reference', () => {
    assert.deepStrictEqual(parseSheetRef('L24'), { levelNumber: 24 });
    assert.deepStrictEqual(parseSheetRef('B22'), { bankLevel: 22 });
    for (const bad of [null, '', '22', 'X5', 'L', 'L1.5', 'l24', 'L-1']) assert.strictEqual(parseSheetRef(bad), undefined, String(bad));
    assert.strictEqual(sheetRefValue({ levelNumber: 24 }), 'L24');
    assert.strictEqual(sheetRefValue({ bankLevel: 9 }), 'B9');
  });
  it('offers the lowest level with a sheet, else the first older topic, else nothing', () => {
    const lv = (levelNumber: number, sets: number) => ({ levelNumber, title: '', group: '', sets });
    assert.strictEqual(firstChoice([lv(30, 1), lv(24, 2), lv(20, 0)], [{ bankLevel: 22, title: '', sets: 1 }]), 'L24');
    assert.strictEqual(firstChoice([lv(20, 0)], [{ bankLevel: 31, title: '', sets: 1 }, { bankLevel: 22, title: '', sets: 1 }]), 'B22');
    assert.strictEqual(firstChoice([], []), undefined);
  });
  it('splits choices by line', () => {
    assert.deepStrictEqual(parseOptions(' 1\n\n 2 \n  \n3'), ['1', '2', '3']);
    assert.deepStrictEqual(parseOptions(''), []);
  });
});
