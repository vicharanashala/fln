import assert from 'node:assert';
import { isPrintedSheetId, parsePrintedSheetQr, printedSheetQrText } from './printedSheet';

// the text names the printed sheet and the child, and reads back
const text = printedSheetQrText('ps_ab12cd34ef56', 'stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789');
assert.equal(text, 'ps_ab12cd34ef56|stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789');
assert.deepStrictEqual(parsePrintedSheetQr(text), { printedSheetId: 'ps_ab12cd34ef56', studentId: 'stu_0b1f2c3d-4e5f-6789-abcd-ef0123456789' });

// a scanner may hand the text back JSON-quoted, or with spaces around it
assert.deepStrictEqual(parsePrintedSheetQr(JSON.stringify(text)), parsePrintedSheetQr(text));
assert.deepStrictEqual(parsePrintedSheetQr(`  ${text}\n`), parsePrintedSheetQr(text));

// ids from the in-memory store read back too
assert.deepStrictEqual(parsePrintedSheetQr(printedSheetQrText('ps_7', 'stu_12')), { printedSheetId: 'ps_7', studentId: 'stu_12' });

// anything that is not one of our papers is refused
for (const bad of [null, undefined, 7, {}, '', 'hello', 'ps_ab12', 'ps_ab12|', '|stu_1', 'ps_ab 12|stu_1', 'ps_ab12|stu 1', 'ps_ab12|stu_1|2', 'PS_ab12|stu_1', 'CW_ab12|stu_1|1|3', 'ps_ab12|' + 'x'.repeat(81)]) {
  assert.equal(parsePrintedSheetQr(bad), null, String(bad));
}

// an id that could not be read back is refused when the text is made, not when it is scanned
assert.throws(() => printedSheetQrText('att_1', 'stu_1'), RangeError);
assert.throws(() => printedSheetQrText('ps_1', 'stu 1'), RangeError);
assert.throws(() => printedSheetQrText('ps_1', 'a|b'), RangeError);
assert.equal(isPrintedSheetId('ps_ab12cd34ef56'), true);
assert.equal(isPrintedSheetId('ps_'), false);
assert.equal(isPrintedSheetId(5), false);
console.log('printedSheet: ok');
