import { readFileSync } from 'node:fs';
import { CLASS_LEVEL_RANGES, CURRICULUM_MAPPING, type ClassStage } from '@fln/curriculum';
import { QUESTIONS_PER_CONCEPT } from '@fln/domain';

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
  level: number;
  title: string;
  conceptId: string | undefined;
  set: number;
  questions: SheetQuestion[];
  /** Same order as `questions`; kept apart so the printed paper can never carry the answers by accident. */
  answers: string[];
}
export interface LevelInfo { level: number; title: string; conceptId: string | undefined; sets: number }

export type ClassName = Exclude<ClassStage, 'Beyond MVP'>;
export const CLASS_NAMES = Object.keys(CLASS_LEVEL_RANGES) as ClassName[];

export interface QuestionBank {
  /** Levels that have at least one full five-question sheet, up to and including the class's last level. */
  levelsForClass(className: ClassName): LevelInfo[];
  /** The sheet for a level, or undefined when the level or set does not exist. */
  sheet(level: number, set: number): Sheet | undefined;
}

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

  const info = (level: number): LevelInfo | undefined => {
    const list = byLevel.get(level);
    const sets = list ? Math.floor(list.length / QUESTIONS_PER_CONCEPT) : 0;
    if (!list || sets === 0) return undefined;
    return { level, title: CURRICULUM_MAPPING[level]?.levelTitle ?? list[0].levelTitle, conceptId: CURRICULUM_MAPPING[level]?.conceptId, sets };
  };

  return {
    levelsForClass(className) {
      const last = CLASS_LEVEL_RANGES[className][1];
      const out: LevelInfo[] = [];
      for (let level = 1; level <= last; level++) { const i = info(level); if (i) out.push(i); }
      return out;
    },
    sheet(level, set) {
      const i = info(level);
      if (!i || !Number.isInteger(set) || set < 0 || set >= i.sets) return undefined;
      const picked = byLevel.get(level)!.slice(set * QUESTIONS_PER_CONCEPT, (set + 1) * QUESTIONS_PER_CONCEPT);
      return {
        level, title: i.title, conceptId: i.conceptId, set,
        questions: picked.map((q, idx) => ({ n: idx + 1, text: q.questionText, svg: q.svgHtml ?? null })),
        answers: picked.map(q => q.answer),
      };
    },
  };
}
