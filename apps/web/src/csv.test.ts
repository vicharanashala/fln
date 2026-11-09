import assert from 'node:assert';
import { describe, it } from 'node:test';
import { nextFontSize, normaliseClass, parseStudentCsv, splitCsvLine } from './csv';

describe('splitCsvLine', () => {
  it('handles quotes, commas inside quotes and doubled quotes', () => {
    assert.deepStrictEqual(splitCsvLine('a, "b, c" ,"d ""e"""'), ['a', 'b, c', 'd "e"']);
    assert.deepStrictEqual(splitCsvLine(''), ['']);
    assert.deepStrictEqual(splitCsvLine('x,,y'), ['x', '', 'y']);
  });
});

describe('normaliseClass', () => {
  it('maps the ways schools write a class to ours and leaves the rest as typed', () => {
    assert.deepStrictEqual(['2', 'class 2', 'Class-2', 'CLASS_3', ' 1 ', 'Balvatika 3', 'balvatika'].map(normaliseClass), ['Class 2', 'Class 2', 'Class 2', 'Class 3', 'Class 1', 'Balvatika', 'Balvatika']);
    assert.strictEqual(normaliseClass('Preschool 1'), 'Preschool 1');
    assert.strictEqual(normaliseClass(''), '');
  });
});

describe('parseStudentCsv', () => {
  it('reads the live platform\'s template and keeps only name, class and section', () => {
    const csv = 'name,classGroup,section,aadharNumber,dob,gender,guardianName,address\n"Aarav Sharma",Class 2,B,123456789012,2018-06-15,Male,Rakesh,"Village Road, Near School"\n';
    const r = parseStudentCsv(csv);
    assert.deepStrictEqual(r.rows, [{ name: 'Aarav Sharma', className: 'Class 2', section: 'B' }]);
    assert.ok(!JSON.stringify(r).includes('123456789012'), 'ID numbers are not carried along');
    assert.deepStrictEqual(r.problems, []);
  });
  it('accepts the simple template, a BOM, Windows line endings and a missing section', () => {
    const r = parseStudentCsv('\uFEFFName,Class\r\nAsha,1\r\nRavi,Balvatika\r\n');
    assert.deepStrictEqual(r.rows, [{ name: 'Asha', className: 'Class 1', section: 'A' }, { name: 'Ravi', className: 'Balvatika', section: 'A' }]);
  });
  it('reports each bad row with its spreadsheet row number and still returns the good ones', () => {
    const r = parseStudentCsv('name,class\nAsha,2\n,2\nMeera,Preschool 1\nKabir,9\nZoya,3\n');
    assert.deepStrictEqual(r.rows.map(x => x.name), ['Asha', 'Zoya']);
    assert.deepStrictEqual(r.problems.map(p => p.line), [3, 4, 5]);
    assert.match(r.problems[0].reason, /name is empty/);
    assert.match(r.problems[1].reason, /Preschool 1/);
  });
  it('refuses a file without the needed columns or without children', () => {
    assert.throws(() => parseStudentCsv('name\nAsha'), /class/);
    assert.throws(() => parseStudentCsv('class\n2'), /name/);
    assert.throws(() => parseStudentCsv('name,class'), /header row/);
    assert.throws(() => parseStudentCsv(''), /header row/);
  });
});

describe('nextFontSize', () => {
  it('moves in steps and stays between 80 and 150 percent', () => {
    assert.strictEqual(nextFontSize(100, 10), 110);
    assert.strictEqual(nextFontSize(150, 10), 150);
    assert.strictEqual(nextFontSize(80, -10), 80);
    assert.strictEqual(nextFontSize(100, -10), 90);
  });
});
