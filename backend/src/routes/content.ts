import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CURRICULUM_MAPPING, LevelConceptConfig } from '../config/curriculumMap';
import { QuestionService } from '../services/questionService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

interface RawQuestion {
  level: number;
  levelTitle: string;
  section: string;
  sectionType: string;
  questionNumber: number;
  questionText: string;
  answer: string;
  svgHtml?: string;
}

// In-memory cache of question bank loaded from data/questionBank.json
let questionBankCache: RawQuestion[] | null = null;

function loadQuestionBank(): RawQuestion[] {
  if (questionBankCache) return questionBankCache;
  try {
    const qbPath = path.resolve(ROOT_DIR, 'data', 'questionBank.json');
    if (fs.existsSync(qbPath)) {
      const data = fs.readFileSync(qbPath, 'utf8');
      questionBankCache = JSON.parse(data);
      return questionBankCache || [];
    }
  } catch (err) {
    console.error('Failed to load questionBank.json:', err);
  }
  return [];
}

const STAGE_TO_CLASS: Record<number, string> = {
  1: 'Preschool 1',
  2: 'Preschool 2',
  3: 'Preschool 3',
  4: 'Class 1',
  5: 'Class 2',
  6: 'Class 3',
  7: 'Class 4',
};

interface SubLevelInfo {
  subLevel: number;
  title: string;
  content: string;
}

interface LevelDetailPayload {
  levelNumber: number;
  levelTitle: string;
  stage: number;
  classGroup: string;
  ageGroup: string;
  strand: string;
  conceptId: string;
  objective: string;
  description: string;
  learningOutcome: string;
  topicsCovered: string[];
  subLevels: SubLevelInfo[];
  questionCount: number;
}

function findLevelDir(levelNumber: number): string | null {
  const baseDir = path.resolve(ROOT_DIR, 'FLN Levels Structure');
  if (!fs.existsSync(baseDir)) return null;

  const entries = fs.readdirSync(baseDir);
  // Match e.g. "Level 22_ Ordering (1-50)" or "Level 1_ Quantity  Comparison"
  const regex = new RegExp(`^Level\\s+0*${levelNumber}([_\\s]|$)`, 'i');
  const match = entries.find(e => regex.test(e));
  return match ? path.join(baseDir, match) : null;
}

function parseLevelMarkdown(levelDir: string, levelConfig: LevelConceptConfig): {
  objective: string;
  description: string;
  learningOutcome: string;
  topicsCovered: string[];
  subLevels: SubLevelInfo[];
} {
  let objective = `Master foundational competencies for Level ${levelConfig.levelNumber}: ${levelConfig.levelTitle}.`;
  let description = `Interactive exercises and mastery progression in ${levelConfig.strand} designed for ${levelConfig.ageGroup} years.`;
  let learningOutcome = `Students demonstrate confidence and conceptual mastery in ${levelConfig.levelTitle}.`;
  let topicsCovered: string[] = [levelConfig.levelTitle, levelConfig.strand];
  const subLevels: SubLevelInfo[] = [];

  try {
    const files = fs.readdirSync(levelDir);

    // Look for main level file e.g. "Level 22_ Ordering.md"
    const mainFile = files.find(f => f.toLowerCase().startsWith('level') && f.endsWith('.md'));
    if (mainFile) {
      const content = fs.readFileSync(path.join(levelDir, mainFile), 'utf8');

      const objMatch = content.match(/##\s*Objective\s*\n+([\s\S]*?)(?=\n##|$)/i);
      if (objMatch) objective = objMatch[1].trim();

      const descMatch = content.match(/##\s*Description\s*\n+([\s\S]*?)(?=\n##|$)/i);
      if (descMatch) description = descMatch[1].trim();

      const loMatch = content.match(/##\s*Learning\s*Outcome\s*\n+([\s\S]*?)(?=\n##|$)/i);
      if (loMatch) learningOutcome = loMatch[1].trim();

      const topicsMatch = content.match(/##\s*Topics\s*Covered\s*\n+([\s\S]*?)(?=\n##|$)/i);
      if (topicsMatch) {
        topicsCovered = topicsMatch[1]
          .split('\n')
          .map(t => t.replace(/^[\s*\-•]+/, '').trim())
          .filter(Boolean);
      }
    }

    // Look for sub-level markdown files e.g. "22.0.md", "22.1.md", "22.2.md"
    const subFiles = files.filter(f => /^\d+\.\d+\.md$/i.test(f)).sort();
    for (const sf of subFiles) {
      const subNumMatch = sf.match(/^\d+\.(\d+)\.md$/i);
      const subNum = subNumMatch ? parseInt(subNumMatch[1], 10) : 0;
      const subContent = fs.readFileSync(path.join(levelDir, sf), 'utf8');

      const titleMatch = subContent.match(/\*\*\*\s*(.*?)\s*\*\*\*/);
      const title = titleMatch ? titleMatch[1] : `Sub-Level ${levelConfig.levelNumber}.${subNum}`;

      subLevels.push({
        subLevel: subNum,
        title,
        content: subContent.replace(/\*\*\*\s*(.*?)\s*\*\*\*/, '').trim(),
      });
    }
  } catch (err) {
    console.error(`Error parsing markdown for level ${levelConfig.levelNumber}:`, err);
  }

  // If no sub-levels found in files, generate standard .0, .1, .2 defaults
  if (subLevels.length === 0) {
    subLevels.push({
      subLevel: 0,
      title: `Level ${levelConfig.levelNumber}.0 — Core Mastery`,
      content: `Standard grade-level competency assessment for ${levelConfig.levelTitle}.`,
    });
    subLevels.push({
      subLevel: 1,
      title: `Level ${levelConfig.levelNumber}.1 — Guided Remediation`,
      content: `Visual scaffolded assistance with step-by-step problem breakdown.`,
    });
    subLevels.push({
      subLevel: 2,
      title: `Level ${levelConfig.levelNumber}.2 — Concrete Foundational Support`,
      content: `Object-mediated and pictorial representations to build base intuition.`,
    });
  }

  return { objective, description, learningOutcome, topicsCovered, subLevels };
}

export function registerContentRoutes(app: express.Express) {
  // GET /api/content/levels - List all 93 levels with summary metadata
  app.get('/api/content/levels', (_req, res) => {
    const qb = loadQuestionBank();
    const qbCountByLevel = qb.reduce((acc, q) => {
      acc[q.level] = (acc[q.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const levels = Object.values(CURRICULUM_MAPPING).map(cfg => ({
      id: cfg.levelNumber,
      levelNumber: cfg.levelNumber,
      name: cfg.levelTitle,
      levelTitle: cfg.levelTitle,
      stage: cfg.stage,
      class: STAGE_TO_CLASS[cfg.stage] || `Class ${cfg.stage}`,
      classGroup: STAGE_TO_CLASS[cfg.stage] || `Class ${cfg.stage}`,
      ageGroup: cfg.ageGroup,
      strand: cfg.strand,
      conceptId: cfg.conceptId,
      questionCount: qbCountByLevel[cfg.levelNumber] || 0,
    }));

    res.json(levels);
  });

  // GET /api/content/levels/:levelId - Detailed view of a single level
  app.get('/api/content/levels/:levelId', (req, res) => {
    const levelNumber = parseInt(req.params.levelId, 10);
    const cfg = CURRICULUM_MAPPING[levelNumber];

    if (!cfg) {
      return res.status(404).json({ error: `Level ${req.params.levelId} not found in curriculum.` });
    }

    const qb = loadQuestionBank();
    const questionsForLevel = qb.filter(q => q.level === levelNumber);

    const levelDir = findLevelDir(levelNumber);
    const parsed = levelDir
      ? parseLevelMarkdown(levelDir, cfg)
      : {
          objective: `Understand and apply competencies for ${cfg.levelTitle}.`,
          description: `Foundational learning activities for ${cfg.strand} in ${STAGE_TO_CLASS[cfg.stage]}.`,
          learningOutcome: `Student can solve problems involving ${cfg.levelTitle}.`,
          topicsCovered: [cfg.levelTitle, cfg.strand],
          subLevels: [
            { subLevel: 0, title: `Level ${cfg.levelNumber}.0 — Core Mastery`, content: 'Grade-level mastery assessment.' },
            { subLevel: 1, title: `Level ${cfg.levelNumber}.1 — Guided Remediation`, content: 'Scaffolded practice.' },
            { subLevel: 2, title: `Level ${cfg.levelNumber}.2 — Concrete Foundations`, content: 'Pictorial/object support.' },
          ],
        };

    const payload: LevelDetailPayload = {
      levelNumber: cfg.levelNumber,
      levelTitle: cfg.levelTitle,
      stage: cfg.stage,
      classGroup: STAGE_TO_CLASS[cfg.stage] || `Class ${cfg.stage}`,
      ageGroup: cfg.ageGroup,
      strand: cfg.strand,
      conceptId: cfg.conceptId,
      ...parsed,
      questionCount: questionsForLevel.length,
    };

    res.json(payload);
  });

  // GET /api/content/levels/:levelId/questions - Questions for a level
  app.get('/api/content/levels/:levelId/questions', (req, res) => {
    const levelNumber = parseInt(req.params.levelId, 10);
    const cfg = CURRICULUM_MAPPING[levelNumber];

    if (!cfg) {
      return res.status(404).json({ error: `Level ${req.params.levelId} not found.` });
    }

    const qb = loadQuestionBank();
    let questions = qb.filter(q => q.level === levelNumber);

    // If level is not present in questionBank.json, generate questions from concept generator
    if (questions.length === 0) {
      const generated = QuestionService.getQuestionsByLevel(levelNumber, 0);
      questions = generated.map((g: any, idx) => ({
        level: levelNumber,
        levelTitle: cfg.levelTitle,
        section: `${levelNumber}.0 — Core Mastery`,
        sectionType: 'mastery',
        questionNumber: idx + 1,
        questionText: g.question || g.question_text || `Question ${idx + 1}`,
        answer: g.answer || g.expected_answer || 'N/A',
        svgHtml: g.svgAsset || g.svg_snippet,
      }));
    }

    // Optional section filter
    const sectionType = req.query.sectionType as string;
    if (sectionType) {
      questions = questions.filter(q => q.sectionType?.toLowerCase() === sectionType.toLowerCase());
    }

    res.json({
      levelNumber,
      levelTitle: cfg.levelTitle,
      totalQuestions: questions.length,
      questions,
    });
  });

  // GET /api/content/search - Search across curriculum & questions
  app.get('/api/content/search', (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase();
    if (!query) {
      return res.json({ results: [] });
    }

    const qb = loadQuestionBank();
    const matchingQuestions = qb.filter(q =>
      q.questionText?.toLowerCase().includes(query) ||
      q.levelTitle?.toLowerCase().includes(query) ||
      q.answer?.toLowerCase().includes(query)
    ).slice(0, 50);

    const matchingLevels = Object.values(CURRICULUM_MAPPING).filter(c =>
      c.levelTitle.toLowerCase().includes(query) ||
      c.strand.toLowerCase().includes(query) ||
      c.conceptId.toLowerCase().includes(query) ||
      String(c.levelNumber).includes(query)
    );

    res.json({
      query,
      levelsCount: matchingLevels.length,
      questionsCount: matchingQuestions.length,
      levels: matchingLevels,
      questions: matchingQuestions,
    });
  });
}
