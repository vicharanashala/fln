import { QUESTIONS_PER_CONCEPT } from '@fln/domain';
import { HttpError } from '../http';
import type { QuestionBank, SheetQuestion } from '../questionBank';
import type { Repos } from '../repos';

/** One printable five-question sheet, whichever source it came from. Answers stay apart from the questions. */
export interface ResolvedSheet {
  bankLevel: number | null;
  levelNumber: number | null;
  title: string;
  set: number;
  questions: SheetQuestion[];
  answers: string[];
}

export interface SheetRequest { bankLevel?: unknown; levelNumber?: unknown; set?: unknown }

export interface SheetService {
  /**
   * A sheet comes from approved written questions of a curriculum level (`levelNumber`), or, until those exist,
   * from the older bank (`bankLevel`). Exactly one of the two is given.
   */
  resolve(request: SheetRequest): Promise<ResolvedSheet>;
}

export function createSheetService(repos: Repos, bank: QuestionBank): SheetService {
  return {
    async resolve(body) {
      const set = body.set ?? 0;
      const hasLevel = body.levelNumber !== undefined && body.levelNumber !== null;
      const hasBank = body.bankLevel !== undefined && body.bankLevel !== null;
      if (hasLevel === hasBank) throw new HttpError(400, 'Give either levelNumber or bankLevel.');
      if (!Number.isInteger(set) || (set as number) < 0) throw new HttpError(400, 'set must be a whole number.');
      const setNo = set as number;
      if (hasLevel) {
        if (!Number.isInteger(body.levelNumber)) throw new HttpError(400, 'levelNumber must be a whole number.');
        const level = await repos.levels.byNumber(body.levelNumber as number);
        if (!level) throw new HttpError(404, 'Level not found.');
        const written = (await repos.questions.byLevel(level.levelNumber)).filter(q => q.status === 'approved' && q.mode === 'written');
        const picked = written.slice(setNo * QUESTIONS_PER_CONCEPT, (setNo + 1) * QUESTIONS_PER_CONCEPT);
        if (picked.length < QUESTIONS_PER_CONCEPT) throw new HttpError(404, 'This level does not have enough approved questions for a worksheet yet.');
        return {
          bankLevel: null, levelNumber: level.levelNumber, title: level.title, set: setNo,
          questions: picked.map((q, i) => ({ n: i + 1, text: q.prompt, svg: q.svg, options: q.options })),
          answers: picked.map(q => q.answer),
        };
      }
      if (!Number.isInteger(body.bankLevel)) throw new HttpError(400, 'bankLevel must be a whole number.');
      const sheet = bank.sheet(body.bankLevel as number, setNo);
      if (!sheet) throw new HttpError(404, 'There is no worksheet for that topic yet.');
      return { bankLevel: sheet.bankLevel, levelNumber: null, title: sheet.title, set: sheet.set, questions: sheet.questions, answers: sheet.answers };
    },
  };
}
