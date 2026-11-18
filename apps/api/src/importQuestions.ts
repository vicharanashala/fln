import { readFields } from './routes/content';
import { HttpError } from './http';
import type { Repos } from './repos';

export interface ImportReport { total: number; added: number; alreadyThere: number; applied: boolean }

const MAX_ITEMS = 500;
const keyOf = (q: { levelNumber: number; prompt: string; answer: string; svg: string | null }) => JSON.stringify([q.levelNumber, q.prompt, q.answer, q.svg ?? '']);

/**
 * Adds written-out questions to the database as DRAFTS, under the same rules as a question typed into the app (readFields).
 * All or nothing: if any item breaks a rule, nothing is written and the message names every item that did.
 * Safe to run twice: a question already there (same level, wording, answer and drawing, in any status) is skipped.
 * Without `apply` nothing is written; the report says what would happen.
 */
export async function importQuestions(repos: Repos, items: unknown, createdBy: string, apply: boolean): Promise<ImportReport> {
  if (!Array.isArray(items) || items.length === 0) throw new Error('The file must hold a list of questions.');
  if (items.length > MAX_ITEMS) throw new Error(`The file holds ${items.length} questions; at most ${MAX_ITEMS} at a time.`);
  const problems: string[] = [];
  const ready: { levelNumber: number; conceptId: string; fields: ReturnType<typeof readFields>; source: 'authored' | 'balvatika-review' }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    const where = `Item ${i + 1}`;
    const n = item?.levelNumber;
    const level = Number.isInteger(n) ? await repos.levels.byNumber(n as number) : undefined;
    if (!level) { problems.push(`${where}: level ${String(n)} does not exist.`); continue; }
    try {
      const fields = readFields(item, level.levelNumber);
      const key = keyOf({ levelNumber: level.levelNumber, ...fields });
      if (seen.has(key)) { problems.push(`${where} (level ${level.levelNumber}): the same question is in the file twice.`); continue; }
      seen.add(key);
      ready.push({ levelNumber: level.levelNumber, conceptId: level.conceptId, fields, source: item.source === 'balvatika-review' ? 'balvatika-review' : 'authored' });
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      problems.push(`${where} (level ${level.levelNumber}): ${e.message}`);
    }
  }
  if (problems.length > 0) throw new Error(`Nothing was written. ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);

  const existing = new Set<string>();
  for (const n of new Set(ready.map(r => r.levelNumber))) for (const q of await repos.questions.byLevel(n)) existing.add(keyOf(q));
  const fresh = ready.filter(r => !existing.has(keyOf({ levelNumber: r.levelNumber, ...r.fields })));
  if (apply) {
    const now = new Date().toISOString();
    for (const r of fresh) {
      await repos.questions.add({
        levelNumber: r.levelNumber, conceptId: r.conceptId, ...r.fields, status: 'draft', source: r.source,
        createdBy, createdAt: now, updatedAt: now, approvedBy: null, approvedAt: null,
      });
    }
  }
  return { total: ready.length, added: apply ? fresh.length : 0, alreadyThere: ready.length - fresh.length, applied: apply };
}
