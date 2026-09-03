import { Express } from 'express';
import { dbStore } from '../db';
import { routerService } from '../services/remediation/router.service';

// Types inlined from the former interfaces/examBlueprint.interface.ts
// (Mongoose-specific Document extensions removed per ADR-001)

export interface NumericConstraint {
  min: number;
  max: number;
}

export interface NumericBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'NUMERIC';
  templateText: string;
  variableConstraints: Record<string, NumericConstraint>;
}

export interface MatrixBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'MATRIX';
  templateText: string;
  matrixArrays: {
    targetGroup: string[];
    foilGroup: string[];
  };
}

export interface GenerativeBlueprint {
  questionNum: number;
  concept: string;
  explanation?: string;
  type: 'GENERATIVE';
  templateText: string;
  promptTemplate?: string;
}

export type BlueprintQuestion = NumericBlueprint | MatrixBlueprint | GenerativeBlueprint;

export interface ExamBlueprint {
  id: string;
  examId: string;
  examName: string;
  questions: BlueprintQuestion[];
}

export function registerBlueprintRoutes(app: Express) {
  // GET /api/blueprint
  app.get('/api/blueprint', async (req, res) => {
    try {
      const { examId } = req.query;
      let blueprints = await dbStore.getExamBlueprints();
      if (examId) {
        blueprints = blueprints.filter(b => b.examId === examId);
      }
      res.status(200).json({ success: true, data: blueprints });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/blueprint — creation is managed automatically by the Content Ingestion Parser
  app.post('/api/blueprint', (_req, res) => {
    res.status(501).json({ success: false, error: 'Creation is managed automatically by the Content Ingestion Parser.' });
  });

  // PUT /api/blueprint/:id — updates are managed automatically by the Content Ingestion Parser
  app.put('/api/blueprint/:id', (_req, res) => {
    res.status(501).json({ success: false, error: 'Updates are managed automatically by the Content Ingestion Parser.' });
  });

  // DELETE /api/blueprint/:id — deletions are managed automatically by the Content Ingestion Parser
  app.delete('/api/blueprint/:id', (_req, res) => {
    res.status(501).json({ success: false, error: 'Deletion is managed automatically by the Content Ingestion Parser.' });
  });

  // POST /api/blueprint/:id/test-generate
  app.post('/api/blueprint/:id/test-generate', async (req, res) => {
    try {
      const { id } = req.params;
      const all = await dbStore.getExamBlueprints();
      const blueprint = all.find(b => b.id === id) || null;

      if (!blueprint || !blueprint.questions || blueprint.questions.length === 0) {
        return res.status(404).json({ success: false, error: 'Blueprint or questions not found' });
      }

      const generated = await routerService.route(blueprint.questions[0] as BlueprintQuestion);
      res.status(200).json({ success: true, data: generated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
