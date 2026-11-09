import type { Attempt, Band, Topic } from './types';

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
