import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "./db";

// Valid Gemini model IDs, primary first then fallbacks (used by generateContentWithRetry).
// Centralized here so the call sites below don't drift; these match the IDs the
// ai-services Python pipeline uses (ai-services/scripts/_api.py). The previous IDs
// ("gemini-3.5-flash" / "gemini-3.1-*") do not exist and made every AI call 404.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0];

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

/**
 * Call Gemini API with retries and exponential backoff, falling back to other models if needed.
 */
async function generateContentWithRetry(params: {
  contents: any;
  config?: any;
  model?: string;
}): Promise<any> {
  const modelsToTry = [
    params.model || DEFAULT_GEMINI_MODEL,
    ...GEMINI_MODELS.slice(1),
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
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
Implement "Weakest-Level Mapping" (SRS §6.2): Assign the student to the lowest level (from 1 to 59) where they showed weakness or made mistakes, or level 1 if they struggle with everything. If they solved all perfectly, assign level 35.
Provide a clean narrative feedback summary.`;

    const response = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are an automated math scoring system for Foundational Literacy & Numeracy.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Number of correct answers" },
            recommendedLevel: { type: Type.INTEGER, description: "Level from 1 to 59 based on weakest-level mapping" },
            narrative: { type: Type.STRING, description: "Warm and encouraging narrative explaining how the student did and what they need to work on." }
          },
          required: ["score", "recommendedLevel", "narrative"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.recommendedLevel && parsed.narrative) {
      return {
        score: parsed.score ?? 0,
        recommendedLevel: parsed.recommendedLevel,
        narrative: parsed.narrative
      };
    }
  } catch (error) {
    console.error("Gemini Diagnostic Evaluation failed, using deterministic logic:", error);
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
    // If they got all questions correct, place them at highest level + 1 (capped at 59)
    const maxLevel = Math.max(...questions.map(q => q.source_level), 0);
    recommendedLevel = Math.min(59, maxLevel + 1);
  }

  return {
    score,
    recommendedLevel,
    narrative: `Determined deterministically: student solved ${score}/${questions.length} questions correctly. Placed at Level ${recommendedLevel} using Weakest-Level Mapping based on incorrect responses.`
  };
}

/**
 * Stage 3: Generate AI-Personalized Worksheet Questions for a Student based on their Current Level
 */
export async function generateAIPersonalizedWorksheet(
  studentName: string,
  level: number,
  topicCategories: string[]
): Promise<Question[]> {
  try {
    const category = topicCategories[Math.floor(Math.random() * topicCategories.length)] || "Number Sense";
    const response = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: `Create exactly 3 math assessment questions for a student named ${studentName} who is currently at Level ${level}.
The main topic area should be around: ${category}.
Include at least one easy, one medium, and one hard difficulty question.
Each question should recommend an SVG asset from: fruits, animals, shapes, numbers.`,
      config: {
        systemInstruction: "You are an automated school assessment sheet planner.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question_id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  answer_type: { type: Type.STRING, enum: ["number", "text", "choice"] },
                  choices: { type: Type.ARRAY, items: { type: Type.STRING } },
                  topic: { type: Type.STRING },
                  subtopic: { type: Type.STRING },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
                  source_level: { type: Type.INTEGER },
                  svgAsset: { type: Type.STRING }
                },
                required: ["question_id", "question", "answer", "answer_type", "topic", "subtopic", "difficulty", "source_level", "svgAsset"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.questions && parsed.questions.length > 0) {
      return parsed.questions;
    }
  } catch (error) {
    console.error(`Gemini Worksheet Generation for Level ${level} failed, compiling pre-built questions:`, error);
  }

  // Fallback questions compiled for the specific level from preseeded pool or logic
  return [
    {
      question_id: `WS_L${level}_Q1`,
      question: `Calculate: ${level * 10} + ${level * 5} = ?`,
      answer: String(level * 10 + level * 5),
      answer_type: 'number',
      topic: 'Number Operations',
      subtopic: 'Addition',
      difficulty: 'easy',
      source_level: level,
      svgAsset: 'numbers'
    },
    {
      question_id: `WS_L${level}_Q2`,
      question: `If you have 4 groups of ${level} circles, how many total circles do you have?`,
      answer: String(4 * level),
      answer_type: 'number',
      topic: 'Shapes',
      subtopic: 'Grouping Multiplication',
      difficulty: 'medium',
      source_level: level,
      svgAsset: 'shapes'
    },
    {
      question_id: `WS_L${level}_Q3`,
      question: `Rani has ${level * 12} rupees. She spends half. How many rupees are left?`,
      answer: String((level * 12) / 2),
      answer_type: 'number',
      topic: 'Money',
      subtopic: 'Fractions of Amount',
      difficulty: 'hard',
      source_level: level,
      svgAsset: 'numbers'
    }
  ];
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
- If score is 80%+ (e.g. 3/3 or near perfect): Recommend Level ${Math.min(59, level + 1)}.
- If score is 50%-80%: Retain at Level ${level}.
- If score is < 50%: Retain at Level ${level} or suggest review at Level ${Math.max(1, level - 1)}.
Generate a narrative report summarizing strengths and learning gaps.`;

    const response = await generateContentWithRetry({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a professional teacher grading and narrative-writing engine.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            conceptMastery: {
              type: Type.OBJECT,
              description: "Mapping of topic name to: Strong, Satisfactory, or Needs Practice"
            },
            narrative: { type: Type.STRING },
            recommendedLevel: { type: Type.INTEGER }
          },
          required: ["score", "conceptMastery", "narrative", "recommendedLevel"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
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
    console.error("Gemini Evaluation Engine failed, running deterministic evaluation:", error);
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
  const recommendedLevel = percent >= 80 ? Math.min(59, level + 1) : level;

  return {
    score,
    total: questions.length,
    conceptMastery,
    recommendedLevel,
    narrative: `Determined deterministically: ${studentName} successfully completed ${score} out of ${questions.length} questions (${percent.toFixed(0)}%). Demonstrates clear progress. Progression: recommended level is Level ${recommendedLevel}.`
  };
}
