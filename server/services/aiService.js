const OpenAI = require('openai');
const aiConfig = require('../config/ai');

let client = null;

function getClient() {
  if (!client) {
    if (!aiConfig.apiKey) {
      throw new Error('AI API key not configured. Set AI_API_KEY or OPENAI_API_KEY environment variable.');
    }
    client = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseURL,
      timeout: aiConfig.timeout,
      maxRetries: 0,
    });
  }
  return client;
}

const SYSTEM_PROMPT = `You are an FLN (Foundational Literacy and Numeracy) assessment question generator for Indian primary school students (Classes 1-5). Generate questions in English with simple, age-appropriate language.

FLN competency levels:
- Level1 (Preschool 1): Count objects to 5, basic shapes, colors, big/small comparisons
- Level2 (Preschool 2): Count to 10, number recognition 1-9, basic addition/subtraction to 5, patterns
- Level3 (Class 1): Numbers 1-100, addition/subtraction to 20, 2D shapes, measuring length
- Level4 (Class 2): Addition/subtraction to 100, multiplication tables 2-5, 3D shapes, time, money
- Level5 (Class 3): Addition/subtraction to 1000, multiplication/division, fractions basics, area, perimeter
- Level6 (Class 4): Large numbers, advanced multiplication/division, equivalent fractions, decimals, geometry
- Level7 (Class 5): LCM/GCD, percentages, ratio, volume, data handling, advanced geometry
- Level8 (Class 6+): Integers, algebra basics, proportions, complex word problems

Return ONLY a valid JSON array of question objects. No markdown, no code fences, no extra text.
Each question object must have this exact structure:
{
  "question_id": "Q1",
  "question": "question text",
  "answer": "correct answer",
  "answer_type": "text",
  "topic": "topic name",
  "difficulty": "easy|medium|hard",
  "source_level": "level name matching the FLN level",
  "class_level": grade number,
  "reasoning": "brief explanation of the learning objective"
}`;

function buildUserPrompt({ grade, subject, studentName, level, weakCompetencies, count }) {
  const weakText = weakCompetencies && weakCompetencies.length > 0
    ? `\nFocus extra questions on weak areas: ${weakCompetencies.join(', ')}`
    : '';

  return `Generate ${count} personalized FLN assessment questions for:

Grade: Class ${grade}
Subject: ${subject || 'Mathematics'}
Student Name: ${studentName}
Current FLN Level: ${level}
${weakText}

Requirements:
- Each question must match the FLN competency for ${level}
- Questions must be appropriate for Class ${grade} level
- Use simple English that an Indian primary school student can understand
- Mix of easy, medium, and hard difficulties
- Cover multiple topics within ${subject}
- Ensure answers are short and unambiguous (single word or number)
- Topic examples: Number Sense, Shapes, Addition, Subtraction, Multiplication, Division, Fractions, Measurement, Time, Money, Data Handling, Patterns, Geometry`;
}

function parseQuestions(raw) {
  if (!raw) return null;

  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
    return null;
  } catch {
    return null;
  }
}

async function generateQuestions({ grade, subject, studentName, level, weakCompetencies, count }) {
  const userPrompt = buildUserPrompt({ grade, subject, studentName, level, weakCompetencies, count });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), aiConfig.timeout);

  try {
    const aiClient = getClient();
    const response = await aiClient.chat.completions.create({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: aiConfig.maxTokens,
      temperature: 0.7,
    }, { signal: controller.signal });

    clearTimeout(timeoutId);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI model');
    }

    const questions = parseQuestions(content);
    if (!questions || questions.length === 0) {
      throw new Error('AI returned invalid or empty question format');
    }

    return questions;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${aiConfig.timeout}ms`);
    }

    if (error.status === 401) {
      throw new Error('Invalid AI API key');
    }

    if (error.status === 429) {
      throw new Error('AI rate limit exceeded. Please try again later.');
    }

    throw new Error(`AI generation failed: ${error.message}`);
  }
}

module.exports = { generateQuestions, parseQuestions };
