import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callLLM, evaluateAIDiagnostic } from './gemini';
import type { Question } from './db';

// gemini.ts reads GROQ_API_KEY / GEMINI_API_KEY from process.env at call
// time (not at import time), so each test can freely set/clear them —
// no chdir/import-ordering concerns here, unlike the DB-backed tests.

test('callLLM: Groq success path returns Groq text and never touches Gemini', async () => {
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: string) => {
    calls++;
    assert.match(String(url), /groq\.com/);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
      text: async () => '',
    } as Response;
  }) as typeof fetch;

  try {
    const result = await callLLM({ systemInstruction: 'sys', prompt: 'hi', jsonMode: true });
    assert.equal(result, '{"ok":true}');
    assert.equal(calls, 1, 'Gemini fallback should never be reached on a Groq success');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});

test('callLLM: Groq 401 is non-retryable and falls through to Gemini', async () => {
  delete process.env.GEMINI_API_KEY; // forces Gemini's own failure to be immediate (NO_API_KEY), no network call
  process.env.GROQ_API_KEY = 'bad-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return {
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'unauthorized',
    } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(() => callLLM({ systemInstruction: 'sys', prompt: 'hi', jsonMode: true }));
    assert.equal(calls, 1, '401 must not be retried before falling through to Gemini');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});

test('callLLM: 429 is retried with backoff before giving up', async () => {
  delete process.env.GEMINI_API_KEY;
  process.env.GROQ_API_KEY = 'rate-limited-key';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return { ok: false, status: 429, json: async () => ({}), text: async () => 'rate limited' } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(() => callLLM({ systemInstruction: 'sys', prompt: 'hi', jsonMode: true }));
    assert.equal(calls, 3, 'expected exactly 3 attempts (maxRetries) before falling through');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
  }
});

test('evaluateAIDiagnostic falls back to deterministic grading when both providers are unavailable', async () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const questions: Question[] = [
    {
      question_id: 'Q1',
      question: '1 + 1 = ?',
      answer: '2',
      answer_type: 'number',
      topic: 'Number Sense',
      subtopic: 'Addition',
      difficulty: 'easy',
      source_level: 1,
      svgAsset: 'numbers',
    },
  ];

  const result = await evaluateAIDiagnostic('Test Student', questions, { Q1: '2' });
  assert.equal(result.score, 1);
  assert.ok(Number.isInteger(result.recommendedLevel) && result.recommendedLevel >= 1);
  assert.match(result.narrative, /Determined deterministically/);
});
