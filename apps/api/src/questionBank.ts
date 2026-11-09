import { readFileSync } from 'node:fs';
import { QUESTIONS_PER_CONCEPT } from '@fln/domain';

/**
 * The only question source v2 has today is the legacy bank carried over from main. It is numbered with the OLD
 * level scheme (for example its level 26 is "Carry Addition"), which does not match the 109-level curriculum, and
 * its topics are mostly Class 1 to 5. So sheets are listed by the bank's own topic names and are not tied to a
 * class or to a curriculum level. The reviewed Balvatika bank replaces this once it is approved.
 */
interface BankRow {
  level: number;
  levelTitle: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml?: string;
}

export interface SheetQuestion { n: number; text: string; svg: string | null }
export interface Sheet {
  bankLevel: number;
  title: string;
  set: number;
  questions: SheetQuestion[];
  /** Same order as `questions`; kept apart so the printed paper can never carry the answers by accident. */
  answers: string[];
}
export interface Topic { bankLevel: number; title: string; sets: number }

export interface QuestionBank {
  /** Topics that have at least one full five-question sheet, in the bank's own order. */
  topics(): Topic[];
  /** The sheet for a topic, or undefined when the topic or set does not exist. */
  sheet(bankLevel: number, set: number): Sheet | undefined;
}

const titleOf = (row: BankRow): string => row.levelTitle.replace(/^Level\s+\d+\s*[\u2014-]\s*/, '').trim();

export function loadQuestionBank(path = new URL('../../../data/questionBank.json', import.meta.url)): QuestionBank {
  const rows = JSON.parse(readFileSync(path, 'utf8')) as BankRow[];
  const byLevel = new Map<number, BankRow[]>();
  for (const row of rows) {
    if (row.sectionType !== 'mastery') continue;
    const list = byLevel.get(row.level) ?? [];
    list.push(row);
    byLevel.set(row.level, list);
  }
  for (const list of byLevel.values()) list.sort((a, b) => a.questionNumber - b.questionNumber);

  const topics: Topic[] = [...byLevel.entries()]
    .map(([bankLevel, list]) => ({ bankLevel, title: titleOf(list[0]), sets: Math.floor(list.length / QUESTIONS_PER_CONCEPT) }))
    .filter(t => t.sets > 0)
    .sort((a, b) => a.bankLevel - b.bankLevel);

  return {
    topics: () => topics.map(t => ({ ...t })),
    sheet(bankLevel, set) {
      const topic = topics.find(t => t.bankLevel === bankLevel);
      if (!topic || !Number.isInteger(set) || set < 0 || set >= topic.sets) return undefined;
      const picked = byLevel.get(bankLevel)!.slice(set * QUESTIONS_PER_CONCEPT, (set + 1) * QUESTIONS_PER_CONCEPT);
      return {
        bankLevel, title: topic.title, set,
        questions: picked.map((q, i) => ({ n: i + 1, text: q.questionText, svg: q.svgHtml ?? null })),
        answers: picked.map(q => q.answer),
      };
    },
  };
}
