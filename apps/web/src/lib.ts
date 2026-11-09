import type { Attempt, Band, ClassLevel, Topic } from './types';

/** One child per line (a pasted spreadsheet column) or separated by commas; blanks and repeats are dropped. */
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function scoreOf(marks: readonly boolean[]): number { return marks.filter(Boolean).length; }

/** Same rule as the server (five questions: 0-1 Emerging, 2-3 Developing, 4-5 Secure), shown live while marking. */
export function bandOf(score: number): Band { return score <= 1 ? 'Emerging' : score <= 3 ? 'Developing' : 'Secure'; }

/** Attempts arrive newest first; the first one seen for a child is the one that counts. */
export function latestByStudent(attempts: readonly Attempt[]): Map<string, Attempt> {
  const latest = new Map<string, Attempt>();
  for (const a of attempts) if (!latest.has(a.studentId)) latest.set(a.studentId, a);
  return latest;
}

/** The topic to offer first: the one with the lowest bank number. */
export function firstTopic(topics: readonly Topic[]): Topic | undefined {
  return topics.reduce<Topic | undefined>((best, t) => (best === undefined || t.bankLevel < best.bankLevel ? t : best), undefined);
}

export function sameMarks(a: readonly boolean[], b: readonly boolean[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function setLetter(set: number): string { return String.fromCharCode(65 + set); }

/** Hash routes: "#/class/abc/print?topic=22&set=0" -> { parts: ['class','abc','print'], query } */
export function parseHash(hash: string): { parts: string[]; query: URLSearchParams } {
  const [path, qs = ''] = hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function svgDataUri(svg: string): string { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }

/** Which sheet a teacher picked: a curriculum level (written "L24") or a topic of the older bank ("B22"). */
export type SheetRef = { levelNumber: number; bankLevel?: undefined } | { bankLevel: number; levelNumber?: undefined };

export function parseSheetRef(value: string | null): SheetRef | undefined {
  const m = /^([LB])(\d+)$/.exec(value ?? '');
  if (!m) return undefined;
  return m[1] === 'L' ? { levelNumber: Number(m[2]) } : { bankLevel: Number(m[2]) };
}
export function sheetRefValue(ref: SheetRef): string { return ref.levelNumber !== undefined ? `L${ref.levelNumber}` : `B${ref.bankLevel}`; }

/** What to offer first: the lowest level that has a sheet, otherwise the first topic of the older bank. */
export function firstChoice(levels: readonly ClassLevel[], topics: readonly Topic[]): string | undefined {
  const level = levels.filter(l => l.sets > 0).reduce<ClassLevel | undefined>((b, l) => (b === undefined || l.levelNumber < b.levelNumber ? l : b), undefined);
  if (level) return `L${level.levelNumber}`;
  const topic = firstTopic(topics);
  return topic ? `B${topic.bankLevel}` : undefined;
}

/** Splits a typed list of choices (one per line) into trimmed, non-empty lines. */
export function parseOptions(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}
