/**
 * Reading a school's student file. Ported from the live FLN `parseCSVText`, with the same column names so existing
 * files keep working, but v2 keeps only name, class and section: the other columns (ID numbers, dates of birth,
 * guardian details, addresses) are read past and never sent to the server.
 */
export interface ImportRow { name: string; className: string; section: string }
export interface ParsedFile { rows: ImportRow[]; problems: { line: number; reason: string }[] }

export const CLASS_CHOICES = ['Balvatika', 'Class 1', 'Class 2', 'Class 3'] as const;

/** Splits one CSV line, honouring quotes and doubled quotes inside them. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

const HEADERS: Record<string, 'name' | 'className' | 'section'> = {
  name: 'name', 'student name': 'name', 'child name': 'name',
  class: 'className', classgroup: 'className', 'class group': 'className', 'class name': 'className', classname: 'className',
  section: 'section',
};

/** "2", "class 2", "Class-2", "balvatika" -> the class names the platform uses; anything else is returned as typed. */
export function normaliseClass(value: string): string {
  const v = value.trim();
  if (/^balvatika/i.test(v)) return 'Balvatika';
  const n = /^(?:class[\s\-_]*)?(\d+)$/i.exec(v);
  return n ? `Class ${Number(n[1])}` : v;
}

export function parseStudentCsv(text: string): ParsedFile {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('The file needs a header row and at least one child.');
  const columns = splitCsvLine(lines[0]).map(h => HEADERS[h.toLowerCase().replace(/\s+/g, ' ')]);
  if (!columns.includes('name')) throw new Error('The first row must have a "name" column.');
  if (!columns.includes('className')) throw new Error('The first row must have a "class" column.');
  const rows: ImportRow[] = [], problems: ParsedFile['problems'] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = splitCsvLine(line);
    const row: ImportRow = { name: '', className: '', section: 'A' };
    columns.forEach((col, c) => { if (col && cells[c] !== undefined) row[col] = col === 'className' ? normaliseClass(cells[c]) : cells[c]; });
    if (!row.section) row.section = 'A';
    const line1 = i + 2; // the spreadsheet row, counting the header as row 1
    if (!row.name) problems.push({ line: line1, reason: 'The name is empty.' });
    else if (!(CLASS_CHOICES as readonly string[]).includes(row.className)) problems.push({ line: line1, reason: `"${row.className || '(empty)'}" is not a class we handle (use ${CLASS_CHOICES.join(', ')}).` });
    else rows.push(row);
  });
  return { rows, problems };
}

export const TEMPLATE_CSV = 'name,class,section\nAarav Sharma,Class 1,A\nDiya Rao,Balvatika,A\n';

/** Text size steps for the A- / A / A+ buttons (percent of the normal size). */
export function nextFontSize(current: number, delta: number): number { return Math.min(150, Math.max(80, current + delta)); }
