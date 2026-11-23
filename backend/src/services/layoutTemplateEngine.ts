/**
 * Turns a Superadmin-authored `LayoutTemplate` into one concrete question:
 * draws every variable with a seeded RNG, fills every `{{placeholder}}`,
 * builds MCQ options, and collects the answer key.
 *
 * Deterministic on purpose: the same template + seed gives the same question
 * and the same key, so a reprint matches its key and ICR marks against what
 * was actually printed. No LLM and no `eval` — expressions go through the small
 * parser below, which only knows numbers, variables, arithmetic, comparisons
 * and a handful of named functions.
 */

import {
  ANSWER_BLOCK_TYPES, LAYOUT_ANSWER_FORMATS, LAYOUT_BLOCK_TYPES, LAYOUT_STATUSES, VARIABLE_KINDS,
  type LayoutBlock, type LayoutTemplate, type LayoutVariable, type ResolvedBlock, type ResolvedLayout,
} from '../types/layoutTemplate';
import { QUESTION_FAMILIES } from '../types/questionTemplateParams';
import { isKnownThemeId, pickVariant, readVariantSvg } from '../svgAssetCatalog';

// ---------------------------------------------------------------- seeded RNG

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** FNV-1a string hash -> uint32. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and the same sequence on every machine for a given seed. */
export function createRng(seed: string): Rng {
  let a = hashString(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T,>(items: readonly T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick: (items) => items[int(0, items.length - 1)], shuffle };
}

// ---------------------------------------------------------------- expressions

export type Value = number | string;
export type Scope = Record<string, Value>;

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '(', ')', '<', '>', '!', ','];
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
};

export class ExpressionError extends Error {}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new ExpressionError(`"${src.slice(i, j)}" is not a number`);
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (!op) throw new ExpressionError(`Unexpected "${c}" in "${src}"`);
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  return out;
}

/**
 * Evaluates `src` against `scope`. Grammar, loosest first:
 * or (||) > and (&&) > comparison > + - > * / % > unary ! - > atom.
 * A bare variable name returns its value as-is (so a `pick` word survives);
 * anything with an operator works on numbers.
 */
export function evaluate(src: string, scope: Scope): Value {
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new ExpressionError('Empty expression');
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const num = (v: Value): number => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) throw new ExpressionError(`"${v}" is not a number`);
    return n;
  };

  const atom = (): Value => {
    const tok = tokens[pos++];
    if (!tok) throw new ExpressionError(`"${src}" ends too early`);
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'id') {
      if (isOp('(')) {
        const fn = Object.prototype.hasOwnProperty.call(FUNCTIONS, tok.v) ? FUNCTIONS[tok.v] : undefined;
        if (!fn) throw new ExpressionError(`Unknown function "${tok.v}"`);
        pos++;
        const args: number[] = [];
        if (!isOp(')')) {
          args.push(num(or()));
          while (isOp(',')) { pos++; args.push(num(or())); }
        }
        if (!isOp(')')) throw new ExpressionError(`Missing ")" in "${src}"`);
        pos++;
        return fn(...args);
      }
      if (!Object.prototype.hasOwnProperty.call(scope, tok.v)) throw new ExpressionError(`Unknown variable "${tok.v}"`);
      return scope[tok.v];
    }
    if (tok.v === '(') {
      const v = or();
      if (!isOp(')')) throw new ExpressionError(`Missing ")" in "${src}"`);
      pos++;
      return v;
    }
    throw new ExpressionError(`Unexpected "${tok.v}" in "${src}"`);
  };
  const unary = (): Value => {
    if (isOp('-')) { pos++; return -num(unary()); }
    if (isOp('!')) { pos++; return num(unary()) ? 0 : 1; }
    return atom();
  };
  const mul = (): Value => {
    let l = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[pos++].v;
      const r = num(unary());
      if ((op === '/' || op === '%') && r === 0) throw new ExpressionError(`Division by zero in "${src}"`);
      l = op === '*' ? num(l) * r : op === '/' ? num(l) / r : num(l) % r;
    }
    return l;
  };
  const add = (): Value => {
    let l = mul();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v;
      const r = num(mul());
      l = op === '+' ? num(l) + r : num(l) - r;
    }
    return l;
  };
  const cmp = (): Value => {
    let l = add();
    while (['<', '>', '<=', '>=', '==', '!='].some(isOp)) {
      const op = tokens[pos++].v;
      const r = add();
      const eq = typeof l === 'string' || typeof r === 'string' ? String(l) === String(r) : l === r;
      const a = op === '==' || op === '!=' ? 0 : num(l);
      const b = op === '==' || op === '!=' ? 0 : num(r);
      const res = op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : op === '==' ? eq : !eq;
      l = res ? 1 : 0;
    }
    return l;
  };
  const and = (): Value => {
    let l = cmp();
    while (isOp('&&')) { pos++; const r = cmp(); l = num(l) && num(r) ? 1 : 0; }
    return l;
  };
  function or(): Value {
    let l = and();
    while (isOp('||')) { pos++; const r = and(); l = num(l) || num(r) ? 1 : 0; }
    return l;
  }

  const result = or();
  if (pos < tokens.length) throw new ExpressionError(`Unexpected "${(tokens[pos] as any).v}" in "${src}"`);
  return result;
}

/** Numbers print without float noise: 7, 2.5, never 2.5000000001. */
export function formatValue(v: Value): string {
  if (typeof v === 'string') return v;
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

const PLACEHOLDER = /\{\{([^{}]+)\}\}/g;

/** Replaces every `{{expr}}` in `text`. */
export function fill(text: string, scope: Scope): string {
  return String(text ?? '').replace(PLACEHOLDER, (_, expr: string) => formatValue(evaluate(expr.trim(), scope)));
}

/** Names used inside `{{...}}` of a string, for validation. */
export function placeholderExpressions(text: string): string[] {
  return [...String(text ?? '').matchAll(PLACEHOLDER)].map(m => m[1].trim());
}

// ---------------------------------------------------------------- variables

const MAX_DRAWS = 200;

/** Draws every variable in order, retrying until all constraints hold. */
export function drawValues(template: Pick<LayoutTemplate, 'variables' | 'constraints'>, rng: Rng): Scope {
  for (let attempt = 0; attempt < MAX_DRAWS; attempt++) {
    const scope: Scope = {};
    for (const v of template.variables) {
      if (v.kind === 'int') {
        const excluded = new Set(v.exclude ?? []);
        let n = rng.int(v.min, v.max);
        for (let k = 0; k < 50 && excluded.has(n); k++) n = rng.int(v.min, v.max);
        scope[v.name] = n;
      } else if (v.kind === 'calc') {
        scope[v.name] = evaluate(v.expr, scope);
      } else if (v.kind === 'pick') {
        scope[v.name] = rng.pick(v.values);
      } else if (v.kind === 'svg') {
        scope[v.name] = rng.pick(v.themeIds);
      }
    }
    const ok = (template.constraints ?? []).every(c => {
      const r = evaluate(c, scope);
      return typeof r === 'number' ? r !== 0 : r !== '';
    });
    if (ok) return scope;
  }
  throw new ExpressionError(
    `No values satisfied the rules after ${MAX_DRAWS} tries. Widen the number ranges or relax the rules.`,
  );
}

// ---------------------------------------------------------------- MCQ options

/** Wrong answers close to a numeric answer, never negative, never equal to it. */
export function nearbyDistractors(answer: string, count: number, rng: Rng): string[] {
  const n = Number(answer);
  if (!Number.isFinite(n)) return [];
  const offsets = rng.shuffle([1, -1, 2, -2, 10, -10, 3, -3, 5, -5]);
  const out: string[] = [];
  for (const off of offsets) {
    const c = n + off;
    if (c < 0 || c === n) continue;
    const s = formatValue(c);
    if (!out.includes(s)) out.push(s);
    if (out.length === count) break;
  }
  return out;
}

// ---------------------------------------------------------------- resolve

const SIZE_PX = { sm: 28, md: 44, lg: 64 } as const;
export const PICTURE_SIZE_PT = SIZE_PX;

function clampSpan(n: unknown): number {
  const s = Math.round(Number(n) || 12);
  return Math.min(12, Math.max(1, s));
}

/**
 * Resolve one template into one question. Throws ExpressionError with a
 * message an author can act on when the template cannot be resolved.
 */
export function resolveLayout(template: LayoutTemplate, seed: string): ResolvedLayout {
  const rng = createRng(`${template.id}:${seed}`);
  const scope = drawValues(template, rng);
  const answers: string[] = [];
  const text: string[] = [];
  let choices: string[] | undefined;
  let mcqCount = 0;

  const resolveBlock = (block: LayoutBlock): ResolvedBlock => {
    const span = clampSpan(block.span);
    const p: any = block.props ?? {};
    switch (block.type) {
      case 'text': {
        const t = fill(p.text, scope);
        text.push(t);
        return { type: 'text', span, text: t, size: p.size ?? 'md', bold: !!p.bold, align: p.align ?? 'left' };
      }
      case 'number': {
        const value = fill(p.value, scope);
        text.push(value);
        return { type: 'number', span, value, boxed: p.boxed !== false, size: p.size ?? 'lg' };
      }
      case 'picture': {
        const themeId = typeof scope[p.svgVar] === 'string' ? String(scope[p.svgVar]) : null;
        const count = Math.max(0, Math.min(30, Math.round(Number(fill(p.count, scope)) || 0)));
        // One picture per variable, not per block: "{{a}} apples + {{b}} apples" must show the same apple twice.
        const variant = themeId ? pickVariant(themeId, `${seed}:${p.svgVar}`) : undefined;
        const svg = variant ? readVariantSvg(variant) : null;
        text.push(`[${count} × ${themeId ?? 'picture'}]`);
        return { type: 'picture', span, svg, variant: variant ? { variantId: variant.variantId, file: variant.file } : null, themeId, count, size: p.size ?? 'md', perRow: Math.max(1, Math.min(10, Number(p.perRow) || 5)) };
      }
      case 'answerBox': {
        answers.push(fill(p.answer, scope));
        const label = fill(p.label ?? '', scope);
        if (label) text.push(label);
        text.push('____');
        return { type: 'answerBox', span, label, boxes: Math.max(1, Math.min(6, Number(p.boxes) || 1)) };
      }
      case 'mcq': {
        mcqCount++;
        const correct = fill(p.answer, scope);
        const want = (Number(p.optionCount) === 3 ? 3 : 4) - 1;
        const authored = (p.distractors ?? []).map((d: string) => fill(d, scope)).filter((d: string) => d !== '' && d !== correct);
        let wrong = [...new Set<string>(authored)].slice(0, want);
        if (wrong.length < want) {
          wrong = [...wrong, ...nearbyDistractors(correct, want - wrong.length + 4, rng).filter(d => !wrong.includes(d))].slice(0, want);
        }
        const options = rng.shuffle([correct, ...wrong]);
        const letter = String.fromCharCode(65 + options.indexOf(correct));
        answers.push(letter);
        choices = options;
        text.push(options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  '));
        return { type: 'mcq', span, options, layout: p.layout === 'stacked' ? 'stacked' : 'inline' };
      }
      case 'trueFalse': {
        const statement = fill(p.statement, scope);
        const truth = evaluate(String(p.truth || '0'), scope);
        answers.push((typeof truth === 'number' ? truth !== 0 : truth !== '') ? 'True' : 'False');
        text.push(`${statement} (True / False)`);
        return { type: 'trueFalse', span, statement };
      }
      case 'match': {
        const pairs = (p.pairs ?? []).map((pr: any) => ({ left: fill(pr.left, scope), right: fill(pr.right, scope) }));
        const order = rng.shuffle(pairs.map((_: unknown, i: number) => i));
        const right = order.map((i: number) => pairs[i].right);
        // Key: for left item i, the letter of its partner on the right.
        answers.push(pairs.map((_: unknown, i: number) => `${i + 1}-${String.fromCharCode(65 + order.indexOf(i))}`).join(', '));
        text.push(pairs.map((pr: any) => pr.left).join(' | '));
        return { type: 'match', span, left: pairs.map((pr: any) => pr.left), right };
      }
      case 'fillBlank': {
        const parts = fill(p.text, scope).split('__');
        const blanks = parts.length - 1;
        const filled = (p.answers ?? []).map((a: string) => fill(a, scope));
        answers.push(filled.slice(0, blanks).join(', '));
        text.push(parts.join('____'));
        return { type: 'fillBlank', span, parts };
      }
      case 'arrange': {
        const items: string[] = (p.items ?? []).map((it: string) => fill(it, scope));
        const sorted = [...items].sort((a, b) => {
          const na = Number(a), nb = Number(b);
          const d = Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
          return p.order === 'desc' ? -d : d;
        });
        answers.push(sorted.join(', '));
        const shown = rng.shuffle(items);
        text.push(shown.join(', '));
        return { type: 'arrange', span, items: shown, order: p.order === 'desc' ? 'desc' : 'asc' };
      }
      case 'spacer':
        return { type: 'spacer', span, height: Math.max(2, Math.min(80, Number(p.height) || 8)) };
      case 'divider':
        return { type: 'divider', span };
      default:
        throw new ExpressionError(`Unknown block type "${(block as any).type}"`);
    }
  };

  const rows = template.rows.map(row => ({ blocks: row.blocks.map(resolveBlock) }));
  const values: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(scope)) values[k] = v;

  const numeric = answers.length === 1 && Number.isFinite(Number(answers[0])) && mcqCount === 0;
  return {
    templateId: template.id,
    seed,
    rows,
    answers,
    values,
    plainText: text.join(' ').replace(/\s+/g, ' ').trim(),
    choices: mcqCount === 1 ? choices : undefined,
    answerType: mcqCount === 1 && answers.length === 1 ? 'choice' : numeric ? 'number' : 'text',
  };
}

// ---------------------------------------------------------------- validation

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,23}$/;
const RESERVED = new Set(Object.keys(FUNCTIONS));
export const MAX_ROWS = 20;
export const MAX_BLOCKS_PER_ROW = 4;
export const MAX_VARIABLES = 12;

/**
 * Checks a template's shape and that it actually resolves. Returns a list of
 * problems written for the author; empty means valid.
 */
export function validateLayoutTemplate(t: Partial<LayoutTemplate>): string[] {
  const errors: string[] = [];
  if (!t.name || !String(t.name).trim()) errors.push('Give the template a name.');
  if (!t.conceptId) errors.push('Choose the level this template is for.');
  if (!t.questionFamily || !(QUESTION_FAMILIES as readonly string[]).includes(t.questionFamily)) errors.push('Choose a question family.');
  if (!t.answerFormat || !(LAYOUT_ANSWER_FORMATS as readonly string[]).includes(t.answerFormat)) errors.push('Choose an answer format.');
  if (t.status && !(LAYOUT_STATUSES as readonly string[]).includes(t.status)) errors.push(`Unknown status "${t.status}".`);

  const vars: LayoutVariable[] = Array.isArray(t.variables) ? t.variables : [];
  if (vars.length > MAX_VARIABLES) errors.push(`Use at most ${MAX_VARIABLES} variables.`);
  const seen = new Set<string>();
  for (const v of vars) {
    if (!NAME_RE.test(v?.name ?? '') || RESERVED.has(v.name)) { errors.push(`"${v?.name}" is not a valid variable name (letters, digits, _; not a function name).`); continue; }
    if (seen.has(v.name)) errors.push(`Variable "${v.name}" is defined twice.`);
    seen.add(v.name);
    if (!(VARIABLE_KINDS as readonly string[]).includes(v.kind)) errors.push(`Variable "${v.name}" has an unknown kind.`);
    if (v.kind === 'int') {
      if (!Number.isInteger(v.min) || !Number.isInteger(v.max)) errors.push(`"${v.name}": min and max must be whole numbers.`);
      else if (v.min > v.max) errors.push(`"${v.name}": min is bigger than max.`);
      else if (v.max - v.min > 100000) errors.push(`"${v.name}": range is too wide.`);
    }
    if (v.kind === 'calc' && !String(v.expr ?? '').trim()) errors.push(`"${v.name}": write a formula, e.g. a + b.`);
    if (v.kind === 'pick' && (!Array.isArray(v.values) || v.values.filter(x => String(x).trim()).length === 0)) errors.push(`"${v.name}": add at least one value to pick from.`);
    if (v.kind === 'svg') {
      if (!Array.isArray(v.themeIds) || v.themeIds.length === 0) errors.push(`"${v.name}": choose at least one picture theme.`);
      else for (const id of v.themeIds) if (!isKnownThemeId(id)) errors.push(`"${v.name}": unknown picture theme "${id}".`);
    }
  }

  const rows = Array.isArray(t.rows) ? t.rows : [];
  if (rows.length === 0) errors.push('Add at least one row with a block.');
  if (rows.length > MAX_ROWS) errors.push(`Use at most ${MAX_ROWS} rows.`);
  let answerBlocks = 0;
  rows.forEach((row, ri) => {
    const blocks = Array.isArray(row?.blocks) ? row.blocks : [];
    if (blocks.length === 0) errors.push(`Row ${ri + 1} is empty.`);
    if (blocks.length > MAX_BLOCKS_PER_ROW) errors.push(`Row ${ri + 1} has more than ${MAX_BLOCKS_PER_ROW} blocks.`);
    const total = blocks.reduce((s, b) => s + clampSpan(b?.span), 0);
    if (total > 12) errors.push(`Row ${ri + 1} is wider than the page (widths add up to ${total}/12).`);
    for (const b of blocks) {
      if (!(LAYOUT_BLOCK_TYPES as readonly string[]).includes(b?.type)) errors.push(`Row ${ri + 1} has an unknown block "${b?.type}".`);
      if (ANSWER_BLOCK_TYPES.includes(b?.type)) answerBlocks++;
      if (b?.type === 'picture') {
        const sv = vars.find(v => v.name === (b.props as any)?.svgVar);
        if (!sv || sv.kind !== 'svg') errors.push(`Row ${ri + 1}: a picture block needs a picture variable.`);
      }
    }
  });
  if (rows.length > 0 && answerBlocks === 0 && t.answerFormat !== 'observed') {
    errors.push('Add a block the child answers in (answer box, MCQ, true/false, match, fill in the blanks or arrange).');
  }

  // Only try resolving once the shape is sound: the errors above explain more than a resolve failure would.
  if (errors.length === 0) {
    try {
      for (let i = 0; i < 5; i++) resolveLayout({ id: t.id ?? 'validate', ...t } as LayoutTemplate, `validate-${i}`);
    } catch (err: any) {
      errors.push(err instanceof ExpressionError ? err.message : `Could not build a question: ${err?.message ?? err}`);
    }
  }
  return errors;
}
