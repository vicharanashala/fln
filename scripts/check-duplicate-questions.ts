// Issue #399: calls every generator in frontend/public/worksheets/levels_main.html
// programmatically and flags generators at real risk of producing duplicate
// questions within a single generated set, once the requested question count
// exceeds the generator's real content pool (issue #398's original finding:
// duplicates only surfaced once the requested count exceeded the pool) — or,
// worse, generators that hang the render pipeline outright once asked for too
// many.
//
// This script only READS levels_main.html — it drives the page's own
// GENERATORS/LEVELS globals via Puppeteer and never edits the file. It is the
// automated companion to #398 (the manual audit-and-fix pass over the ~225
// generators not already covered by PR #306's Micro-Practice fix): this script
// finds candidates for that pass, and re-verifies fixes don't regress later.
//
// Ground facts this script relies on (see levels_main.html):
//   - GENERATORS: plain object, ~244 entries, each (params, subIdx, qc, sectionId,
//     sectionName) -> {html, answers}.
//   - LEVELS: array of {id, title, subs, slug, build}; level.build(subIdx) returns
//     the real [{letter, name, type, params}] a level actually uses in production
//     (see buildWorksheet(), the function that drives generators for real papers).
//     build() only returns descriptors — it never calls a generator itself, so
//     enumeration can safely stay a single page.evaluate() call.
//   - makeAnsItem(...) -> {questionId, sectionId, sectionName, questionNo,
//     answerType, correctAnswer, coordHint, icrNote}. questionId is a positional
//     counter (qidOf(qc) = pad4(qc.n++)) and is NOT a content signal.
//
// What this script does NOT check (deliberately excluded): it does not
// compare output across independent calls simulating different students
// ("cross-call" checking). Two different students independently sampling a
// handful of items from the same small bank will overlap by ordinary chance,
// regardless of whether that generator's own within-set exclusion logic is
// correct — that's arithmetic, not a missing exclusion check. #398's actual
// concern — and the only thing within-call escalation below measures — is a
// single student seeing the same question twice within their own one
// generated set.
//
// Why this does NOT key on correctAnswer, even when it looks "structural" (an
// object/array, or a multi-digit string): an object correctAnswer is only a
// safe comparison key if it happens to capture every dimension the generator
// actually varies, and there's no way to know that generically without
// reading each generator body by hand. Two concrete counterexamples:
//   - three-size-comparison: correctAnswer is {optionIndex}, the SLOT the
//     biggest item landed in after a shuffle of 3 fixed sizes — only 3
//     possible values. At n=6, two questions landing in the same slot is
//     near-guaranteed by chance, but they draw an independently-random THEME
//     each time (a fish vs. a jar vs. a face) — a different question that
//     happens to share a slot.
//   - odd-one-out-same-icon: correctAnswer is {optionIndex, icon} — the ODD
//     item and its slot, but never the MAIN item (the 4 matching ones), which
//     is independently randomized too. Two questions can share the exact same
//     odd-item-and-slot while differing completely in what the 4 "same"
//     items are (4 rulers + a bus vs. 4 erasers + a bus) — different
//     question, same key.
//
// So instead: diff the actual rendered per-question HTML, since that's
// everything the student sees, stripped of positional artifacts (the
// question's own qid string, and its visible "N." number label) that would
// otherwise make two genuinely identical questions look different just for
// appearing at a different position in the set.
//
// Segmenting one generator call's returned html into per-question chunks is
// the one generic assumption this relies on, since generators don't return
// per-question html separately, only one concatenated string. makeAnsItem's
// questionId (e.g. "Q0007") is unique per question and gets embedded in that
// question's own markup (almost always in a data-omr attribute, since these
// are OMR-scanned worksheets) — but embedded MID-ROW, after the row's own
// header/instruction text, not at the row's start. Anchoring a segment on the
// FIRST occurrence of its qid is wrong: it pulls the NEXT row's header into
// THIS row's segment and drops this row's own header, so two segments can
// compare equal purely because the next row's header text happens to
// coincide, even though the rows themselves differ. Anchoring on the END of a
// qid's LAST occurrence instead keeps each row's own header attached to
// itself; only a few bytes of generic closing markup after the last qid
// mention leak into the next segment, which is boilerplate and identical
// across rows, so it can't manufacture a false match.
//
// A generator whose questionId can't be found in its own html at all (no
// data-omr, no OMR target) is marked "not HTML-segmentable" rather than
// silently skipped or guessed at — but it's still fully hang-tested, since a
// hang has nothing to do with whether its output happens to be segmentable.
//
// Why EVERY generator call is individually timeout-guarded, unconditionally,
// including the generator's own unmodified real params: escalated
// (artificially inflated) counts aren't the only way to hit a generator's
// unsafe "pick a distinct value" retry loop (e.g.
// `while(counts.length<n){ const c=ri(2,8); if(!counts.includes(c))
// counts.push(c); }`, which spins forever once `n` exceeds the range the retry
// can ever satisfy) — a generator can hang on its own, real, already-shipped
// production params with no escalation involved (compare-equal-match does).
// JavaScript cannot preempt a foreign synchronous infinite loop from inside
// the same call, so the only fully robust answer is: no generator invocation
// anywhere in this script runs outside a per-call timeout+recovery
// wrapper — not escalated calls, not the generator's own
// natural-count call either. Only enumeration (pure LEVELS.build() traversal,
// never touches GENERATORS) is exempt, and stays a single evaluate() call.
//
// Usage: npx tsx scripts/check-duplicate-questions.ts
// Exit code 0 = no NEW "bug"-severity findings (see the baseline ratchet
// section below — a pre-existing baselined bug is reported but does not fail
// the run). Exit code 1 = at least one NEW one found.
// Add --write-baseline to regenerate scripts/duplicate-questions-baseline.json
// from a clean run instead of checking against it (always exits 0).
//
// IMPORTANT — severity is provisional for escalated-count duplicates. The
// exact rule for "this duplicate means a missing exclusion check" vs. "this
// duplicate is expected because the request exceeded the generator's real
// pool" is still an open question on issue #399, not yet settled by the team.
// A duplicate at the generator's OWN natural count is never provisional —
// that's happening today, in production, regardless of how #399 resolves.
// Neither is a hang. Every other part of this script only ever calls
// classifySeverity() below — when the real answer lands, change the escalated-
// count rule there and nowhere else.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Page, Browser } from 'puppeteer';
import { launchBrowser } from '../backend/src/browser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEVELS_MAIN_HTML = path.join(ROOT, 'frontend', 'public', 'worksheets', 'levels_main.html');

// The count ladder tried for one generator: rung 0 is always its own real,
// unmodified production params (n = whatever the generator naturally uses);
// subsequent rungs multiply that natural count, escalating to find the
// smallest n at which a duplicate (or a hang) first appears. Stops early on a
// duplicate, a hang, or once bumping n stops changing the generator's actual
// output length (it's ignoring the override).
const ESCALATION_MULTIPLIERS = [2, 4, 8, 16, 32];
const ESCALATION_CAP = 60; // absolute ceiling on n, regardless of multiplier

// Per-call wall-clock budget. Confirmed empirically that a genuine hang is a
// true infinite loop, not just slow, so this only needs to be comfortably
// above normal single-call execution time.
const CALL_TIMEOUT_MS = 2000;

// ---------------------------------------------------------------------------
// Types for the compact data crossing the Puppeteer/CDP boundary. No raw
// html/answers ever cross it — only these small per-generator records.
// ---------------------------------------------------------------------------
interface EnumeratedGenerator {
  type: string;
  unreached: boolean;
  contextCount: number;
  params: any;
  subIdx: number;
}

interface EnumerationSummary {
  totalTypes: number;
  unreachedTypes: string[];
  generators: EnumeratedGenerator[];
}

type Rung = 'natural' | number;

interface CheckResult {
  checked: boolean;
  triedNs: Rung[];
  naturalN: number | null;
  segmentable: boolean;
  firstDuplicateAtN: Rung | null;
  lastCleanN: Rung | null; // the last rung tried before firstDuplicateAtN that showed no duplicate — for an honest "confirmed unique up to here" claim, not an assumed n-1
  firstHangAtN: Rung | null;
  ignoredCountOverride: boolean;
  error?: string;
}

interface GeneratorFinding extends EnumeratedGenerator {
  check: CheckResult | null;
  severity: 'bug' | 'expected-exhaustion' | 'none';
  severityReason: string;
  kind?: BugKind;
}

// ---------------------------------------------------------------------------
// The in-page enumeration harness. Runs once, in a single page.evaluate()
// call — this is the one part of the audit that's genuinely exempt from the
// per-call-timeout requirement, because it never invokes a GENERATORS entry
// at all, only reads LEVELS[i].build(subIdx)'s returned descriptors. Puppeteer
// serializes only this function's own source into the page, so it can't close
// over anything declared outside it in this file.
// ---------------------------------------------------------------------------
function enumerationHarness(): EnumerationSummary {
  /* eslint-disable no-undef */
  // GENERATORS and LEVELS are declared with `const` at the top level of
  // levels_main.html's own <script> block. Classic (non-module) <script>
  // top-level `const`/`let` bindings live in a shared script-scope for the
  // page's realm, NOT as properties of window/globalThis — so
  // `globalThis.GENERATORS` is undefined even though a bare `GENERATORS`
  // reference, evaluated as new top-level code in that same realm (exactly
  // what page.evaluate() does), resolves correctly. Reference them by name,
  // not through globalThis.
  // @ts-ignore — GENERATORS doesn't exist in this file's own TS compilation
  // context, only inside the page this function runs in.
  const GENS: Record<string, unknown> = GENERATORS;
  // @ts-ignore — same as above, for LEVELS.
  const LVLS: Array<{ id: number; title: string; subs: number; slug: string; build: (subIdx: number) => Array<{ letter: string; name: string; type: string; params: any }> }> = LEVELS;

  const allTypes = Object.keys(GENS);
  const contexts: Record<string, Array<{ subIdx: number; params: any }>> = {};
  for (const level of LVLS) {
    for (let subIdx = 0; subIdx < level.subs; subIdx++) {
      let secs: Array<{ letter: string; name: string; type: string; params: any }>;
      try {
        secs = level.build(subIdx);
      } catch {
        continue; // a small number of levels/subIdx combos aren't buildable in isolation; skip, don't crash the whole run
      }
      secs.forEach((sd) => {
        (contexts[sd.type] ??= []).push({ subIdx, params: sd.params || {} });
      });
    }
  }
  const unreachedTypes = allTypes.filter((t) => !contexts[t]);

  const generators: EnumeratedGenerator[] = allTypes.map((type) => {
    const ctxList = contexts[type] || [];
    if (ctxList.length === 0) {
      return { type, unreached: true, contextCount: 0, params: {}, subIdx: 0 };
    }
    // Representative case: the first real level/section context that uses
    // this generator. A generator reused across several levels/sections with
    // different params is checked once, not once per context — acceptable
    // for a risk scan; a "bug" finding is grounds to look at the generator
    // itself, not just this one context.
    return { type, unreached: false, contextCount: ctxList.length, params: ctxList[0].params, subIdx: ctxList[0].subIdx };
  });

  return { totalTypes: allTypes.length, unreachedTypes, generators };
}

// ---------------------------------------------------------------------------
// The one per-generator page function that actually calls a GENERATORS entry.
// MUST be fully self-contained — Puppeteer's page.evaluate() ships only this
// function's own source text into the browser (see enumerationHarness's
// comment on __name for the same constraint). A call to a "helper" declared
// elsewhere in this Node file is not a closure once it crosses that boundary —
// it's a ReferenceError in the page, since that helper's source never travels
// with it. Every helper this function needs must be nested inside it.
//
// `n === null` means "call with the generator's own real, unmodified params" —
// whatever count it naturally produces. Any other value overrides `params.n`.
// Always attempts HTML segmentation and returns `segmentable`, so hang-testing
// and duplicate-checking can be decided independently by the caller: a
// non-segmentable generator is still fully exercised for hangs, it just can't
// have hasDuplicate trusted for it.
// ---------------------------------------------------------------------------
function callGenerator(type: string, params: any, subIdx: number, n: number | null): { length: number; hasDuplicate: boolean; segmentable: boolean } {
  // Every generator's randomness (ri/pick/shuffle/sample, per levels_main.html's
  // own definitions) funnels through Math.random(). Left as real entropy, the
  // natural-count duplicate check is a coin flip, not a fact: a generator can
  // report "duplicate" on one run and "clean" on the next with no code change
  // in between, because the very randomness the check is measuring also
  // decides whether it fires. That's unusable as a CI gate — a PR's pass/fail
  // would depend on dice, not on what it changed. So Math.random is
  // overridden here with a PRNG seeded deterministically from (type, subIdx,
  // n, params) — same inputs, same random sequence, same output, every run,
  // forever. Restored immediately after so it can't leak into anything else
  // running on this page.
  //
  // Trade-off, stated plainly: this now tests one fixed random trajectory per
  // generator/params/n, not "can this ever collide." A generator with real
  // collision risk could dodge it on this particular seed (false negative);
  // one with negligible risk could get unlucky on it forever (false
  // positive). That's the same limitation any deterministic snapshot carries.
  // It's the right trade for a CI gate, which needs a stable yes/no far more
  // than it needs to sample the full probability distribution on every run —
  // but it means a "no duplicate" here is not a formal guarantee, and an
  // occasional manual re-check with real randomness (this script, pre-seeding,
  // run by hand) remains worthwhile.
  function seedFromString(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed: number): () => number {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedKey = `${type}|${subIdx}|${n === null ? 'natural' : n}|${JSON.stringify(params)}`;
  const originalRandom = Math.random;
  Math.random = mulberry32(seedFromString(seedKey));

  let out: { html: string; answers: Array<{ questionId: string }> };
  try {
    // @ts-ignore
    const gen = GENERATORS[type];
    const qc = { n: 1 };
    const callParams = n === null ? params : { ...params, n };
    out = gen(callParams, subIdx, qc, 'S01', 'audit');
  } finally {
    Math.random = originalRandom;
  }
  const answers = out.answers || [];
  const html: string = out.html || '';

  if (answers.length === 0) {
    return { length: 0, hasDuplicate: false, segmentable: false };
  }

  // Anchor each segment on the END of its qid's LAST occurrence (see the file
  // header for why not the first): everything from just after the previous
  // question's last qid mention up to just after this question's last qid
  // mention. This keeps a question's own header/instruction text attached to
  // itself, at the cost of a few bytes of generic closing markup after the
  // last qid mention leaking into the next segment — boilerplate, identical
  // across rows, so it can't manufacture a false match.
  const endPositions = answers.map((a) => {
    const qid = String(a.questionId);
    const last = html.lastIndexOf(qid);
    return last === -1 ? -1 : last + qid.length;
  });
  const segmentable = endPositions.every((p) => p >= 0) && endPositions.every((p, i) => i === 0 || p > endPositions[i - 1]);
  if (!segmentable) {
    return { length: answers.length, hasDuplicate: false, segmentable: false };
  }

  const seen = new Set<string>();
  let hasDuplicate = false;
  for (let i = 0; i < answers.length; i++) {
    const raw = html.slice(i === 0 ? 0 : endPositions[i - 1], endPositions[i]);
    let normalized = raw.split(String(answers[i].questionId)).join('QID');
    normalized = normalized.replace(/Q\d{4}/g, 'QID');
    normalized = normalized.replace(/<span class="q-num">[^<]*<\/span>/gi, '<span class="q-num"></span>');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (normalized.length < 20) continue; // degenerate/too-short segment — skip rather than risk a false match
    if (seen.has(normalized)) {
      hasDuplicate = true;
      break;
    }
    seen.add(normalized);
  }
  return { length: answers.length, hasDuplicate, segmentable: true };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function primePage(page: Page) {
  await page.goto(`file://${LEVELS_MAIN_HTML}`, { waitUntil: 'networkidle0', timeout: 30000 });
  // tsx/esbuild injects __name(fn, "fn") calls into compiled output to
  // preserve function names for stack traces. page.evaluate() ships only the
  // target function's own source text into the browser — the __name helper
  // definition (which lives in esbuild's bundle preamble on the Node side)
  // never travels with it, so the page throws "__name is not defined" the
  // moment it hits a nested named function. Shim a no-op version first;
  // __name(fn, name) just returns fn unchanged, so this is harmless.
  await page.evaluate(() => {
    if (typeof (globalThis as any).__name !== 'function') {
      (globalThis as any).__name = (fn: any) => fn;
    }
  });
}

// Runs one timeout-guarded page.evaluate() call. On timeout, discards the
// (now permanently wedged) page and hands back a fresh, primed one via
// pageRef — page.close() talks to the browser process, not the wedged
// renderer's own JS thread, so it doesn't need that thread's cooperation to
// succeed even though the thread itself never returns.
async function guardedCall(browser: Browser, pageRef: { page: Page }, type: string, params: any, subIdx: number, n: number | null): Promise<{ ok: true; value: { length: number; hasDuplicate: boolean; segmentable: boolean } } | { ok: false; hanged: boolean; error?: string }> {
  try {
    const value = await withTimeout(pageRef.page.evaluate(callGenerator, type, params, subIdx, n), CALL_TIMEOUT_MS);
    return { ok: true, value };
  } catch (e: any) {
    const hanged = e && e.message === 'TIMEOUT';
    if (hanged) {
      try {
        await pageRef.page.close();
      } catch {
        /* already gone */
      }
      pageRef.page = await browser.newPage();
      await primePage(pageRef.page);
    }
    return { ok: false, hanged, error: hanged ? undefined : String((e && e.message) || e) };
  }
}

async function runChecks(browser: Browser, pageRef: { page: Page }, gen: EnumeratedGenerator): Promise<CheckResult> {
  const triedNs: Rung[] = [];
  let naturalN: number | null = null;
  let segmentable = false;
  let firstDuplicateAtN: Rung | null = null;
  let lastCleanN: Rung | null = null;
  let firstHangAtN: Rung | null = null;
  let ignoredCountOverride = false;
  let error: string | undefined;
  let prevLen: number | null = null;

  // Rung 0: the generator's own real, already-shipped params — no override.
  // Always run, always hang-tested, regardless of whether its html turns out
  // to be segmentable for duplicate-checking.
  triedNs.push('natural');
  const naturalOutcome = await guardedCall(browser, pageRef, gen.type, gen.params, gen.subIdx, null);
  if (!naturalOutcome.ok) {
    if (naturalOutcome.hanged) firstHangAtN = 'natural';
    else error = `threw on its own real production params: ${naturalOutcome.error}`;
    return { checked: true, triedNs, naturalN: null, segmentable, firstDuplicateAtN, lastCleanN, firstHangAtN, ignoredCountOverride, error };
  }
  naturalN = naturalOutcome.value.length;
  prevLen = naturalN;
  segmentable = naturalOutcome.value.segmentable;
  if (!segmentable) {
    lastCleanN = 'natural'; // "clean" here means "hang-checked OK"; duplicate status is simply not determinable for this generator
  } else if (naturalOutcome.value.hasDuplicate) {
    firstDuplicateAtN = 'natural';
  } else {
    lastCleanN = 'natural';
  }

  // Escalation rungs — only pursued while nothing terminal has been found yet.
  if (firstDuplicateAtN === null) {
    const baseN = (gen.params && gen.params.n) || naturalN || 1;
    for (const mult of ESCALATION_MULTIPLIERS) {
      const n = Math.min(ESCALATION_CAP, baseN * mult);
      if (triedNs.includes(n)) continue;
      triedNs.push(n);

      const outcome = await guardedCall(browser, pageRef, gen.type, gen.params, gen.subIdx, n);
      if (!outcome.ok) {
        if (outcome.hanged) firstHangAtN = n;
        else error = `threw at n=${n} (escalated beyond production count): ${outcome.error}`;
        break;
      }

      if (prevLen !== null && outcome.value.length === prevLen) ignoredCountOverride = true;
      prevLen = outcome.value.length;

      if (segmentable && outcome.value.hasDuplicate) {
        firstDuplicateAtN = n;
        break;
      }
      lastCleanN = n;
      if (ignoredCountOverride) break; // n isn't actually changing anything, no point continuing
      if (n >= ESCALATION_CAP) break;
    }
  }

  return { checked: true, triedNs, naturalN, segmentable, firstDuplicateAtN, lastCleanN, firstHangAtN, ignoredCountOverride, error };
}

// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for bug vs. expected-exhaustion vs. none. See the
// file header: issue #399 hasn't settled the escalated-count rule yet. Every
// finding in this script is classified by this one function and nowhere else.
// A hang, a thrown exception, and a duplicate at the generator's own natural
// count are never "expected" or provisional — those are real, present-tense
// problems regardless of that open question.
// ---------------------------------------------------------------------------
// `kind` is only set on 'bug' severity — it's the stable, machine-readable
// identity a baseline entry keys on (see the baseline section below). Keep it
// derived only from CheckResult fields, never from the human-readable
// `reason` string, so wording can change freely without silently breaking
// every existing baseline entry.
type BugKind = 'thrown' | 'hang' | 'natural-duplicate';

function classifySeverity(check: CheckResult | null): { severity: 'bug' | 'expected-exhaustion' | 'none'; reason: string; kind?: BugKind } {
  if (!check) {
    return { severity: 'none', reason: 'no level reaches this generator — nothing to exercise' };
  }
  if (check.error) {
    return { severity: 'bug', kind: 'thrown', reason: `threw an exception (not a hang, not a duplicate): ${check.error}` };
  }
  if (check.firstHangAtN !== null) {
    const where = check.firstHangAtN === 'natural' ? 'its own real production params (n unmodified)' : `n=${check.firstHangAtN} (escalated beyond production count)`;
    return { severity: 'bug', kind: 'hang', reason: `hangs when called with ${where} — does not return within ${CALL_TIMEOUT_MS}ms. Likely an unbounded "pick a distinct value" retry loop against a small fixed pool; this is a production denial-of-service risk, not just a duplicate.` };
  }
  if (check.firstDuplicateAtN === 'natural') {
    return { severity: 'bug', kind: 'natural-duplicate', reason: `duplicate question within a single call at its OWN real production count (n=${check.naturalN}) — happening today, in production, not just under escalation` };
  }
  if (check.firstDuplicateAtN !== null) {
    return {
      severity: 'expected-exhaustion',
      reason: `PROVISIONAL: first duplicate only at n=${check.firstDuplicateAtN}, after n=${check.lastCleanN} confirmed duplicate-free. Re-check once #399's threshold discussion lands.`,
    };
  }
  if (!check.segmentable) {
    return { severity: 'none', reason: `not duplicate-checkable (this generator's questionId could not be located in its own rendered html, so per-question content can't be segmented), but fully hang-tested up to n=${check.lastCleanN ?? check.naturalN} with no hang found` };
  }
  return { severity: 'none', reason: `no duplicates or hangs found, up to n=${check.lastCleanN ?? check.naturalN}` };
}

// ---------------------------------------------------------------------------
// Baseline ratchet (issue #399 CI gate). A number of bug-severity findings
// already exist in production (see scripts/duplicate-questions-baseline.json
// for the current count) — #398 is the tracked, separate effort to fix them.
// A CI check that hard-fails on all of them from day one on every PR gets
// disabled, not fixed. So the gate only fails on a finding NOT
// already in the committed baseline: a generator regressing to a NEW bug kind,
// or an untouched-until-now generator turning up broken. A pre-existing
// baselined bug is still printed every run (so it stays visible) but never
// fails the build. When #398 fixes one, its entry stops reproducing and this
// script says so — removing it from the baseline is a deliberate, reviewable
// diff, not automatic, so the baseline can only ever shrink on purpose.
//
// Keyed on (type, kind) rather than type alone: a generator baselined for a
// hang that ALSO starts producing a natural-count duplicate is a genuinely
// new problem, not the same one, even though the generator name is already
// listed.
//
// Regenerate after fixing baselined bugs (or, in the CI workflow, to seed the
// file for the first time) with:
//   npm run check:duplicate-questions -- --write-baseline
// ---------------------------------------------------------------------------
const BASELINE_PATH = path.join(ROOT, 'scripts', 'duplicate-questions-baseline.json');

interface BaselineEntry {
  type: string;
  kind: BugKind;
}

interface BaselineFile {
  note: string;
  generatedAt: string;
  entries: BaselineEntry[];
}

function baselineKey(e: { type: string; kind: BugKind }): string {
  return `${e.type}::${e.kind}`;
}

function readBaseline(): BaselineEntry[] {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  try {
    const parsed: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    return parsed.entries || [];
  } catch (e) {
    console.error(`Could not parse baseline file at ${BASELINE_PATH}: ${(e as Error).message}. Treating baseline as empty (every bug will be reported as new).`);
    return [];
  }
}

function writeBaseline(bugFindings: GeneratorFinding[]) {
  const entries: BaselineEntry[] = bugFindings.map((f) => ({ type: f.type, kind: f.kind! })).sort((a, b) => (a.type + a.kind).localeCompare(b.type + b.kind));
  const file: BaselineFile = {
    note:
      "Committed ratchet baseline for issue #399 (see scripts/check-duplicate-questions.ts). Lists generators with a known, pre-existing 'bug'-severity finding, tracked for fixing under issue #398. CI (.github/workflows/*duplicate-question*) only fails a PR on a finding NOT listed here. When a listed generator is fixed, its entry stops reproducing and the script says so — remove it by hand, or regenerate this whole file from a clean run with: npm run check:duplicate-questions -- --write-baseline",
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(file, null, 2) + '\n');
  console.log(`Wrote ${entries.length} entries to ${BASELINE_PATH}`);
}

// ---------------------------------------------------------------------------
// Node-side driver.
// ---------------------------------------------------------------------------
const WRITE_BASELINE = process.argv.includes('--write-baseline');

async function main() {
  const browser = await launchBrowser();
  try {
    const pageRef = { page: await browser.newPage() };
    await primePage(pageRef.page);

    const enumStart = Date.now();
    const enumeration = await pageRef.page.evaluate(enumerationHarness);
    const enumerationMs = Date.now() - enumStart;

    const results: GeneratorFinding[] = [];
    const probeStart = Date.now();
    for (const gen of enumeration.generators) {
      if (gen.unreached) {
        const { severity, reason } = classifySeverity(null);
        results.push({ ...gen, check: null, severity, severityReason: reason });
        continue;
      }
      const check = await runChecks(browser, pageRef, gen);
      const { severity, reason, kind } = classifySeverity(check);
      results.push({ ...gen, check, severity, severityReason: reason, kind });
    }
    const probeMs = Date.now() - probeStart;

    const bugFindings = results.filter((r) => r.severity === 'bug');

    if (WRITE_BASELINE) {
      writeBaseline(bugFindings);
      process.exit(0);
    }

    const baseline = readBaseline();
    const baselineKeys = new Set(baseline.map(baselineKey));
    const currentBugKeys = new Set(bugFindings.map((f) => baselineKey({ type: f.type, kind: f.kind! })));

    const newBugs = bugFindings.filter((f) => !baselineKeys.has(baselineKey({ type: f.type, kind: f.kind! })));
    const baselinedBugs = bugFindings.filter((f) => baselineKeys.has(baselineKey({ type: f.type, kind: f.kind! })));
    const nowFixed = baseline.filter((e) => !currentBugKeys.has(baselineKey(e)));

    report({ totalTypes: enumeration.totalTypes, unreachedTypes: enumeration.unreachedTypes, results }, enumerationMs, probeMs, { newBugs, baselinedBugs, nowFixed, baselineExists: fs.existsSync(BASELINE_PATH) });

    process.exit(newBugs.length > 0 ? 1 : 0);
  } finally {
    await browser.close();
  }
}

interface FullSummary {
  totalTypes: number;
  unreachedTypes: string[];
  results: GeneratorFinding[];
}

interface BaselineDiff {
  newBugs: GeneratorFinding[];
  baselinedBugs: GeneratorFinding[];
  nowFixed: BaselineEntry[];
  baselineExists: boolean;
}

function formatRungs(ns: Rung[] | undefined): string {
  return (ns || []).join(',');
}

function report(summary: FullSummary, enumerationMs: number, probeMs: number, diff: BaselineDiff) {
  const bugs = summary.results.filter((r) => r.severity === 'bug');
  const expected = summary.results.filter((r) => r.severity === 'expected-exhaustion');
  const notSegmentable = summary.results.filter((r) => r.severity === 'none' && r.check && !r.check.segmentable);
  const clean = summary.results.filter((r) => r.severity === 'none' && r.check && r.check.segmentable);

  console.log(`Checked ${summary.totalTypes} generators — enumeration: ${(enumerationMs / 1000).toFixed(1)}s, probing: ${(probeMs / 1000).toFixed(1)}s.`);
  console.log(`  - ${summary.totalTypes - summary.unreachedTypes.length} reached by at least one level, ${summary.unreachedTypes.length} unreached by any level.`);
  console.log(
    `  - ${bugs.length} flagged as likely bugs (${diff.newBugs.length} NEW, ${diff.baselinedBugs.length} pre-existing/baselined), ${expected.length} as expected exhaustion (provisional), ${notSegmentable.length} not duplicate-checkable but hang-clean, ${clean.length} clean.`
  );
  console.log();

  console.log(
    '*** Severity is PROVISIONAL only for "expected exhaustion" (escalated-count duplicates) — ***\n' +
      '*** the threshold isn\'t settled on issue #399 yet; see classifySeverity() in this script.  ***\n' +
      '*** Hangs, thrown exceptions, and duplicates at a generator\'s OWN natural count are never  ***\n' +
      '*** provisional — those are real, present-tense problems regardless of that open question.  ***\n'
  );

  if (!diff.baselineExists) {
    console.log(
      `*** No baseline file found at ${path.relative(ROOT, BASELINE_PATH)} — EVERY bug below is being   ***\n` +
        '*** reported as NEW, and this run will fail if any exist. Seed the baseline with:            ***\n' +
        '***   npm run check:duplicate-questions -- --write-baseline                                  ***\n'
    );
  }

  // NEW bugs first and most prominent — this is the thing that actually
  // fails CI, so it's the thing a reader needs to act on. Each entry names
  // the generator, the exact kind of finding, the reason, and the one command
  // that reproduces it locally: a red X with no next step is worse than no
  // check at all.
  if (diff.newBugs.length > 0) {
    console.log(`>>> NEW bugs, not in the baseline — THIS IS WHY THE CHECK FAILED (${diff.newBugs.length}):`);
    for (const r of diff.newBugs) {
      console.log(`  - ${r.type}  [${r.kind}]`);
      console.log(`      ${r.severityReason}`);
      if (r.check) console.log(`      tried n=${formatRungs(r.check.triedNs)}`);
    }
    console.log();
    console.log('    To reproduce locally: npm run check:duplicate-questions');
    console.log('    If this generator is a genuine new regression, fix it (see issue #398 for the general pattern:');
    console.log('    an unbounded "pick a distinct value" retry / a pick() with no exclusion of already-used values).');
    console.log('    If this finding is actually pre-existing and just wasn\'t in the baseline yet, or if it\'s a false');
    console.log('    positive in the checker itself, regenerate the baseline after confirming by hand:');
    console.log('      npm run check:duplicate-questions -- --write-baseline');
    console.log();
  }

  if (diff.baselinedBugs.length > 0) {
    console.log(`Pre-existing bugs, already in the baseline (non-blocking, tracked under #398) (${diff.baselinedBugs.length}):`);
    for (const r of diff.baselinedBugs) console.log(`  - ${r.type}  [${r.kind}]: ${r.severityReason}`);
    console.log();
  }

  if (diff.nowFixed.length > 0) {
    console.log(`Baseline entries that no longer reproduce — looks like these got fixed (${diff.nowFixed.length}):`);
    for (const e of diff.nowFixed) console.log(`  - ${e.type}  [${e.kind}]`);
    console.log('    This does not fail the build, but the baseline should be shrunk to match: npm run check:duplicate-questions -- --write-baseline');
    console.log();
  }

  if (summary.unreachedTypes.length > 0) {
    console.log(`Generators no level reaches (${summary.unreachedTypes.length}):`);
    for (const t of summary.unreachedTypes) console.log(`  - ${t}`);
    console.log();
  }

  if (expected.length > 0) {
    console.log(`Expected exhaustion, provisional, never gates the build (${expected.length}):`);
    for (const r of expected) console.log(`  - ${r.type}: ${r.severityReason}`);
    console.log();
  }

  if (notSegmentable.length > 0) {
    console.log(`Not duplicate-checkable (questionId not found in its own rendered html), hang-tested clean (${notSegmentable.length}):`);
    for (const r of notSegmentable) console.log(`  - ${r.type}`);
    console.log();
  }

  if (diff.newBugs.length === 0) {
    console.log('No NEW bugs found in this run — build passes (pre-existing baselined bugs, if any, are listed above).');
  }
}

main().catch((err) => {
  console.error('check-duplicate-questions.ts failed to run:', err);
  process.exit(1);
});
