import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { blueprintEngine } from './blueprintEngine';

export interface QuestionBlueprintItem {
  questionId: string;
  questionNumber: number;
  sectionName: string;
  originalQuestion: string;
  correctAnswer: string;
  questionType: string;
  topic: string;
  blueprintCategory: string;
}

export interface WorksheetBlueprint {
  worksheetId: string;
  studentId: string;
  levelId: number;
  sublevelId: string;
  createdAt: string;
  items: QuestionBlueprintItem[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLUEPRINTS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'blueprints');

// Ensure blueprints directory exists
if (!fs.existsSync(BLUEPRINTS_DIR)) {
  fs.mkdirSync(BLUEPRINTS_DIR, { recursive: true });
}

export class BlueprintService {
  /**
   * Auto-classifies a question into its dynamic blueprint category based on text, section, and type.
   */
  public classifyCategory(questionText: string, sectionName: string, questionType: string = 'standard'): string {
    return sectionName || questionType || 'general';
  }

  /**
   * Creates and saves an Automated Dynamic Blueprint whenever a teacher scans or fetches a worksheet.
   */
  public saveWorksheetBlueprint(
    worksheetId: string,
    studentId: string,
    levelId: number,
    sublevelId: string,
    questions: any[]
  ): WorksheetBlueprint {
    const items: QuestionBlueprintItem[] = (questions || []).map((q, idx) => {
      const qText = q.question || q.questionText || `Question #${idx + 1}`;
      const secName = q.topic || q.sectionName || `Section ${idx + 1}`;
      const qType = q.questionType || q.answer_type || q.type || 'standard';
      const category = this.classifyCategory(qText, secName, qType);

      return {
        questionId: q.question_id || q.questionId || `Q${idx + 1}`,
        questionNumber: idx + 1,
        sectionName: secName,
        originalQuestion: qText,
        correctAnswer: String(q.answer ?? q.correctAnswer ?? ''),
        questionType: qType,
        topic: secName,
        blueprintCategory: category
      };
    });

    const blueprint: WorksheetBlueprint = {
      worksheetId,
      studentId,
      levelId,
      sublevelId,
      createdAt: new Date().toISOString(),
      items
    };

    try {
      const filePath = path.join(BLUEPRINTS_DIR, `${worksheetId}_blueprint.json`);
      fs.writeFileSync(filePath, JSON.stringify(blueprint, null, 2), 'utf-8');
      console.log(`[BlueprintService] Saved dynamic blueprint for ${worksheetId} (${items.length} items).`);
    } catch (err) {
      console.warn(`[BlueprintService] Warning saving blueprint for ${worksheetId}:`, err);
    }

    return blueprint;
  }

  /**
   * Retrieves a saved Worksheet Blueprint by worksheetId, or builds one on the fly.
   */
  public getWorksheetBlueprint(worksheetId: string): WorksheetBlueprint | null {
    try {
      const filePath = path.join(BLUEPRINTS_DIR, `${worksheetId}_blueprint.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[BlueprintService] Warning reading blueprint file for ${worksheetId}:`, e);
    }
    return null;
  }

  /**
   * Generates a practice question for any failed item using its dynamic Blueprint.
   */
  public generatePracticeFromBlueprint(
    originalQuestion: string,
    conceptName: string,
    questionType: string = 'standard',
    originalAnswer: string = '',
    variantIndex: number = 0
  ) {
    return blueprintEngine.generate(originalQuestion, conceptName, questionType, originalAnswer, variantIndex);
  }
}

export const blueprintService = new BlueprintService();
