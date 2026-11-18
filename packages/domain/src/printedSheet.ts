/**
 * The QR code printed on each child's copy of a worksheet (#904).
 *
 * Printing a sheet saves a printed-sheet record, and every child's paper carries a QR code that names that
 * record and the child. A scan can then find the child and the sheet by itself, so the teacher does not have
 * to pick the child. The text is short on purpose: `ps_ab12cd34ef56|stu_0b1f...`.
 */

const PRINTED_SHEET_ID = /^ps_[A-Za-z0-9]{1,40}$/;
const STUDENT_ID = /^[A-Za-z0-9_.-]{1,80}$/;
const QR_TEXT = /^(ps_[A-Za-z0-9]{1,40})\|([A-Za-z0-9_.-]{1,80})$/;

export function isPrintedSheetId(value: unknown): value is string {
  return typeof value === 'string' && PRINTED_SHEET_ID.test(value);
}

/** The text to put in the QR code of one child's paper. Throws for an id that could not be read back. */
export function printedSheetQrText(printedSheetId: string, studentId: string): string {
  if (!isPrintedSheetId(printedSheetId)) throw new RangeError('That is not a printed sheet id.');
  if (typeof studentId !== 'string' || !STUDENT_ID.test(studentId)) throw new RangeError('That student id cannot go in a QR code.');
  return `${printedSheetId}|${studentId}`;
}

/** What a scanner decoded from a QR code, read back. Null for anything that is not one of our papers. */
export function parsePrintedSheetQr(decoded: unknown): { printedSheetId: string; studentId: string } | null {
  if (typeof decoded !== 'string') return null;
  let raw = decoded.trim();
  try { const json: unknown = JSON.parse(raw); if (typeof json === 'string') raw = json; } catch { /* not JSON: use the text as it is */ }
  const m = QR_TEXT.exec(raw);
  return m ? { printedSheetId: m[1], studentId: m[2] } : null;
}
