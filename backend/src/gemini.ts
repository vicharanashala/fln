import { GoogleGenAI } from "@google/genai";
import { Question } from "./db";
import { MAX_LEVEL, SCORE_BAND_STRONG } from "../../shared/constants";

// Valid Gemini model IDs, primary first then fallbacks (used by callGemini).
// Centralized here so the call sites below don't drift; these match the IDs the
// ai-services Python pipeline uses (ai-services/scripts/_api.py). The previous IDs
// ("gemini-3.5-flash" / "gemini-3.1-*") do not exist and made every AI call 404.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-lite-latest"] as const;

// Same model ai-services/scripts/_api.py already uses as its Groq default —
// kept identical so both halves of the system behave consistently.
const GROQ_MODEL = "llama-3.1-8b-instant";

// Helper to get Gemini client or null if key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // In development or if key not configured, we throw a clear error or fallback gracefully
      throw new Error("NO_API_KEY: GEMINI_API_KEY environment variable is not configured in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

type LLMParams = {
  systemInstruction: string;
  prompt: string;
  jsonMode?: boolean;
};

/**
 * Call Gemini with retries and exponential backoff, falling back across
 * models if needed. Returns the raw text response (JSON.parse it yourself
 * when jsonMode is set) — this is the fallback path for callLLM() below,
 * used when Groq is unavailable or fails.
 */
async function callGemini(params: LLMParams): Promise<string> {
  const modelsToTry = GEMINI_MODELS;
  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model,
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            ...(params.jsonMode ? { responseMimeType: "application/json" } : {}),
          },
        });
        if (typeof response.text !== "string") {
          throw new Error("Gemini response missing text");
        }
        return response.text;
      } catch (error: any) {
        lastError = error;
        if (error.message?.includes("NO_API_KEY")) {
          throw error;
        }
        console.warn(`[Gemini Retry] Attempt ${attempt} failed for model ${model}:`, error.message || error);

        if (attempt < maxRetries) {
          const isRateLimitOrUnavailable = error.message?.includes("503") ||
                                           error.message?.includes("UNAVAILABLE") ||
                                           error.message?.includes("429") ||
                                           error.message?.includes("RESOURCE_EXHAUSTED");
          const sleepTime = isRateLimitOrUnavailable ? delay * 1.5 : delay;
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
          delay *= 2; // exponential backoff
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content after retries and model fallbacks");
}

/**
 * Call Groq's OpenAI-compatible chat-completions endpoint, with the same
 * retry/backoff shape ai-services/scripts/_api.py::groq_api_call already
 * uses on the Python side. Throws (rather than falling back itself) on any
 * failure — callLLM() below is what decides to fall through to Gemini.
 */
async function callGroq(apiKey: string, params: LLMParams): Promise<string> {
  const messages = [
    { role: "system", content: params.systemInstruction },
    { role: "user", content: params.prompt },
  ];

  const maxRetries = 3;
  let delay = 1000;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.1,
          max_tokens: 2000,
          ...(params.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw lastError;
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error("Groq response missing choices[0].message.content");
      }
      return text;
    }

    // 401 = bad/missing key — not retryable, let callLLM() fall through to Gemini.
    if (res.status === 401) {
      throw new Error(`GROQ_AUTH_FAILED: ${res.status}`);
    }

    lastError = new Error(`Groq API error ${res.status}: ${(await res.text()).slice(0, 200)}`);

    // 429 (rate limit) / 5xx (server error) — retry with backoff, same as _api.py.
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error("Groq call failed after retries");
}

/**
 * Groq-primary, Gemini-fallback LLM call — mirrors the provider order
 * ai-services/scripts/_api.py already uses on the Python side, so both
 * halves of this system behave consistently instead of depending on two
 * different providers for the same class of work. Returns raw text;
 * callers JSON.parse it themselves when jsonMode is set.
 */
export async function callLLM(params: LLMParams): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      return await callGroq(groqKey, params);
    } catch (error: any) {
      console.warn("[Groq] call failed, falling back to Gemini:", error.message || error);
    }
  }
  return await callGemini(params);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genClass1Question() {
  const a = randomInt(1, 9);
  const b = randomInt(1, 9);
  const isAddition = Math.random() > 0.5;
  const prompt = isAddition ? `${a} + ${b} = ?` : `${Math.max(a, b)} - ${Math.min(a, b)} = ?`;
  const answer = isAddition ? a + b : Math.max(a, b) - Math.min(a, b);
  return { prompt, answer };
}

function genClass2Question() {
  const a = randomInt(10, 99);
  const b = randomInt(10, 99);
  const isAddition = Math.random() > 0.5;
  const prompt = isAddition ? `${a} + ${b} = ?` : `${Math.max(a, b)} - ${Math.min(a, b)} = ?`;
  const answer = isAddition ? a + b : Math.max(a, b) - Math.min(a, b);
  return { prompt, answer };
}

function genClass3Question() {
  const a = randomInt(2, 12);
  const b = randomInt(2, 12);
  return { prompt: `${a} × ${b} = ?`, answer: a * b };
}

function genClass4Question() {
  const divisor = randomInt(2, 12);
  const quotient = randomInt(2, 20);
  const dividend = divisor * quotient;
  return { prompt: `${dividend} ÷ ${divisor} = ?`, answer: quotient };
}

export function generateClassSpecificDiagnostic(classGroup: string): Question[] {
  const normalizedClass = (classGroup || 'Class 1').trim().toLowerCase();
  
  let q1, q2, q3, q4;
  let l1, l2, l3, l4;

  if (normalizedClass.includes('1')) {
    // Class 1
    const res1 = genClass1Question();
    const res2 = genClass1Question();
    const res3 = genClass2Question();
    const res4 = genClass3Question();
    q1 = res1.prompt; l1 = res1.answer;
    q2 = res2.prompt; l2 = res2.answer;
    q3 = res3.prompt; l3 = res3.answer;
    q4 = res4.prompt; l4 = res4.answer;
    
    return [
      {
        question_id: 'DIAG_Q1',
        question: q1,
        answer: String(l1),
        answer_type: 'number',
        topic: 'Number Sense',
        subtopic: 'Single-digit Operations',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'fruits'
      },
      {
        question_id: 'DIAG_Q2',
        question: q2,
        answer: String(l2),
        answer_type: 'number',
        topic: 'Number Sense',
        subtopic: 'Single-digit Operations',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'numbers'
      },
      {
        question_id: 'DIAG_Q3',
        question: q3,
        answer: String(l3),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Two-digit Operations',
        difficulty: 'medium',
        source_level: 2,
        svgAsset: 'shapes'
      },
      {
        question_id: 'DIAG_Q4',
        question: q4,
        answer: String(l4),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'hard',
        source_level: 3,
        svgAsset: 'numbers'
      }
    ];
  } else if (normalizedClass.includes('2')) {
    // Class 2
    const res1 = genClass1Question();
    const res2 = genClass2Question();
    const res3 = genClass2Question();
    const res4 = genClass3Question();
    q1 = res1.prompt; l1 = res1.answer;
    q2 = res2.prompt; l2 = res2.answer;
    q3 = res3.prompt; l3 = res3.answer;
    q4 = res4.prompt; l4 = res4.answer;

    return [
      {
        question_id: 'DIAG_Q1',
        question: q1,
        answer: String(l1),
        answer_type: 'number',
        topic: 'Number Sense',
        subtopic: 'Single-digit Operations',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'fruits'
      },
      {
        question_id: 'DIAG_Q2',
        question: q2,
        answer: String(l2),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Two-digit Operations',
        difficulty: 'medium',
        source_level: 2,
        svgAsset: 'numbers'
      },
      {
        question_id: 'DIAG_Q3',
        question: q3,
        answer: String(l3),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Two-digit Operations',
        difficulty: 'medium',
        source_level: 2,
        svgAsset: 'shapes'
      },
      {
        question_id: 'DIAG_Q4',
        question: q4,
        answer: String(l4),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'hard',
        source_level: 3,
        svgAsset: 'numbers'
      }
    ];
  } else if (normalizedClass.includes('3')) {
    // Class 3
    const res1 = genClass2Question();
    const res2 = genClass3Question();
    const res3 = genClass3Question();
    const res4 = genClass4Question();
    q1 = res1.prompt; l1 = res1.answer;
    q2 = res2.prompt; l2 = res2.answer;
    q3 = res3.prompt; l3 = res3.answer;
    q4 = res4.prompt; l4 = res4.answer;

    return [
      {
        question_id: 'DIAG_Q1',
        question: q1,
        answer: String(l1),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Two-digit Operations',
        difficulty: 'easy',
        source_level: 2,
        svgAsset: 'fruits'
      },
      {
        question_id: 'DIAG_Q2',
        question: q2,
        answer: String(l2),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'medium',
        source_level: 3,
        svgAsset: 'numbers'
      },
      {
        question_id: 'DIAG_Q3',
        question: q3,
        answer: String(l3),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'medium',
        source_level: 3,
        svgAsset: 'shapes'
      },
      {
        question_id: 'DIAG_Q4',
        question: q4,
        answer: String(l4),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'hard',
        source_level: 4,
        svgAsset: 'numbers'
      }
    ];
  } else {
    // Class 4
    const res1 = genClass3Question();
    const res2 = genClass4Question();
    const res3 = genClass4Question();
    const res4 = genClass4Question();
    q1 = res1.prompt; l1 = res1.answer;
    q2 = res2.prompt; l2 = res2.answer;
    q3 = res3.prompt; l3 = res3.answer;
    q4 = res4.prompt; l4 = res4.answer;

    return [
      {
        question_id: 'DIAG_Q1',
        question: q1,
        answer: String(l1),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Multiplication',
        difficulty: 'easy',
        source_level: 3,
        svgAsset: 'fruits'
      },
      {
        question_id: 'DIAG_Q2',
        question: q2,
        answer: String(l2),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'medium',
        source_level: 4,
        svgAsset: 'numbers'
      },
      {
        question_id: 'DIAG_Q3',
        question: q3,
        answer: String(l3),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'medium',
        source_level: 4,
        svgAsset: 'shapes'
      },
      {
        question_id: 'DIAG_Q4',
        question: q4,
        answer: String(l4),
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Division',
        difficulty: 'hard',
        source_level: 4,
        svgAsset: 'numbers'
      }
    ];
  }
}

/**
 * Stage 1: Generate a Class-Specific Math Diagnostic Test
 * Covers questions matched to the student's class group.
 */
export async function generateAIDiagnostic(studentName: string, classGroup: string): Promise<Question[]> {
  try {
    return generateClassSpecificDiagnostic(classGroup);
  } catch (error) {
    console.error("Diagnostic Generation failed, using robust offline fallback questions:", error);
    return [
      {
        question_id: 'DIAG_Q1',
        question: 'Subtract: 9 - 4 = ?',
        answer: '5',
        answer_type: 'number',
        topic: 'Number Operations',
        subtopic: 'Subtraction',
        difficulty: 'easy',
        source_level: 1,
        svgAsset: 'numbers'
      }
    ];
  }
}

/**
 * Stage 2: Evaluate Diagnostic Responses (Weakest-Level Mapping)
 * If the student fails a level, they are placed at that level or their weakest demonstrated level.
 */
export async function evaluateAIDiagnostic(
  studentName: string,
  questions: Question[],
  submittedAnswers: { [questionId: string]: string }
): Promise<{ score: number; recommendedLevel: number; narrative: string }> {
  try {
    const prompt = `Student Name: ${studentName}
Diagnostic Questions: ${JSON.stringify(questions)}
Student Submitted Answers: ${JSON.stringify(submittedAnswers)}

Grade these answers. Compute total score out of ${questions.length}.
Implement "Weakest-Level Mapping" (SRS §6.2): Assign the student to the lowest level (from 1 to ${MAX_LEVEL}) where they showed weakness or made mistakes, or level 1 if they struggle with everything. If they solved all perfectly, assign level 35.
Provide a clean, warm and encouraging narrative feedback summary explaining how the student did and what they need to work on.

Respond with ONLY a JSON object, no other text, with exactly these fields:
{"score": <integer, number of correct answers>, "recommendedLevel": <integer, level from 1 to ${MAX_LEVEL} based on weakest-level mapping>, "narrative": "<string>"}`;

    const text = await callLLM({
      systemInstruction: "You are an automated math scoring system for Foundational Literacy & Numeracy.",
      prompt,
      jsonMode: true,
    });

    const parsed = JSON.parse(text || "{}");
    if (parsed.recommendedLevel && parsed.narrative) {
      return {
        score: parsed.score ?? 0,
        recommendedLevel: parsed.recommendedLevel,
        narrative: parsed.narrative
      };
    }
  } catch (error) {
    console.error("LLM Diagnostic Evaluation failed (Groq and Gemini both unavailable), using deterministic logic:", error);
  }

  // Deterministic fallback grading
  let score = 0;
  let recommendedLevel = 1;

  // Grade the questions deterministically
  questions.forEach((q) => {
    const submitted = (submittedAnswers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (submitted === correct) {
      score++;
    }
  });

  // Weakest level mapping: find the lowest source_level of any failed question
  const failedLevels: number[] = [];
  questions.forEach((q) => {
    const submitted = (submittedAnswers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (submitted !== correct) {
      failedLevels.push(q.source_level);
    }
  });

  if (failedLevels.length > 0) {
    recommendedLevel = Math.min(...failedLevels);
  } else {
    // If they got all questions correct, place them at highest level + 1 (capped at MAX_LEVEL)
    const maxLevel = Math.max(...questions.map(q => q.source_level), 0);
    recommendedLevel = Math.min(MAX_LEVEL, maxLevel + 1);
  }

  return {
    score,
    recommendedLevel,
    narrative: `Determined deterministically: student solved ${score}/${questions.length} questions correctly. Placed at Level ${recommendedLevel} using Weakest-Level Mapping based on incorrect responses.`
  };
}

/**
 * Stage 4: Evaluate Completed Worksheets (ICR Ingestion)
 */
export async function evaluateAIWorksheet(
  studentName: string,
  level: number,
  questions: Question[],
  submittedAnswers: { [questionId: string]: string }
): Promise<{
  score: number;
  total: number;
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  narrative: string;
  recommendedLevel: number;
}> {
  try {
    const prompt = `Student: ${studentName} (Current Level: ${level})
Questions: ${JSON.stringify(questions)}
Answers submitted: ${JSON.stringify(submittedAnswers)}

Grade the student's submission. Evaluate each concept topic.
Recommended Level progression rules:
- If score is ${SCORE_BAND_STRONG}%+ (e.g. 3/3 or near perfect): Recommend Level ${Math.min(MAX_LEVEL, level + 1)}.
- If score is 50%-80%: Retain at Level ${level}.
- If score is < 50%: Retain at Level ${level} or suggest review at Level ${Math.max(1, level - 1)}.
Generate a narrative report summarizing strengths and learning gaps.

Respond with ONLY a JSON object, no other text, with exactly these fields:
{"score": <integer>, "conceptMastery": {<topic name>: "Strong" | "Satisfactory" | "Needs Practice", ...}, "narrative": "<string>", "recommendedLevel": <integer>}`;

    const text = await callLLM({
      systemInstruction: "You are a professional teacher grading and narrative-writing engine.",
      prompt,
      jsonMode: true,
    });

    const parsed = JSON.parse(text || "{}");
    if (parsed.recommendedLevel && parsed.narrative) {
      return {
        score: parsed.score ?? 0,
        total: questions.length,
        conceptMastery: parsed.conceptMastery ?? {},
        narrative: parsed.narrative,
        recommendedLevel: parsed.recommendedLevel
      };
    }
  } catch (error) {
    console.error("LLM Evaluation Engine failed (Groq and Gemini both unavailable), running deterministic evaluation:", error);
  }

  // Deterministic evaluation fallback
  let score = 0;
  const conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};

  questions.forEach((q) => {
    const submitted = (submittedAnswers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    const isCorrect = submitted === correct;

    if (isCorrect) score++;

    const topic = q.topic || 'General Mathematics';
    if (!conceptMastery[topic]) {
      conceptMastery[topic] = isCorrect ? 'Strong' : 'Needs Practice';
    } else if (conceptMastery[topic] === 'Needs Practice' && isCorrect) {
      conceptMastery[topic] = 'Satisfactory';
    }
  });

  const percent = (score / questions.length) * 100;
  const recommendedLevel = percent >= SCORE_BAND_STRONG ? Math.min(MAX_LEVEL, level + 1) : level;

  return {
    score,
    total: questions.length,
    conceptMastery,
    recommendedLevel,
    narrative: `Determined deterministically: ${studentName} successfully completed ${score} out of ${questions.length} questions (${percent.toFixed(0)}%). Demonstrates clear progress. Progression: recommended level is Level ${recommendedLevel}.`
  };
}
