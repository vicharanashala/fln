import { HttpError } from './http';

export interface OllamaConfig { host: string; apiKey?: string; model: string; timeoutMs?: number }

/** Reads what a child wrote for each numbered question; null where blank or unreadable. */
export type ReadAnswers = (input: { imageBase64: string; questions: { n: number; text: string }[] }) => Promise<(string | null)[]>;

const MAX_ANSWER_CHARS = 100;

export function ollamaReader(cfg: OllamaConfig, fetchImpl: typeof fetch = fetch): ReadAnswers {
  return async ({ imageBase64, questions }) => {
    const prompt = [
      'This is a photo of a child\'s maths worksheet. For each numbered question below, copy exactly what the child wrote as the answer.',
      'Do not solve the questions and do not correct the child. If an answer is blank or you cannot read it, use null.',
      'Reply with JSON only, in this shape: {"answers":[{"n":1,"answer":"7"}]}.',
      '',
      ...questions.map(q => `${q.n}. ${q.text}`),
    ].join('\n');
    let res: Response;
    try {
      res = await fetchImpl(`${cfg.host.replace(/\/+$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          stream: false,
          format: {
            type: 'object',
            properties: { answers: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, answer: { type: ['string', 'null'] } }, required: ['n', 'answer'] } } },
            required: ['answers'],
          },
          messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
        }),
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 60_000),
      });
    } catch {
      throw new HttpError(502, 'The photo reader did not answer. Please mark this paper by hand.');
    }
    if (!res.ok) throw new HttpError(502, 'The photo reader could not read this paper. Please mark it by hand.');
    let parsed: unknown;
    try {
      const body = await res.json() as { message?: { content?: string } };
      parsed = JSON.parse(body.message?.content ?? '');
    } catch {
      throw new HttpError(502, 'The photo reader gave an answer we could not use. Please mark this paper by hand.');
    }
    const list = (parsed as { answers?: unknown })?.answers;
    const found = new Map<number, string | null>();
    if (Array.isArray(list)) {
      for (const item of list) {
        const n = (item as { n?: unknown })?.n;
        const a = (item as { answer?: unknown })?.answer;
        if (typeof n !== 'number') continue;
        found.set(n, typeof a === 'string' && a.trim() ? a.trim().slice(0, MAX_ANSWER_CHARS) : null);
      }
    }
    return questions.map(q => found.get(q.n) ?? null);
  };
}
