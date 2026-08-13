import { Request, Response } from 'express';
import { dbStore } from '../db';
import { ExamBlueprint } from '../models/ExamBlueprint.model';
import { routerService } from '../services/remediation/router.service';
import { IExamBlueprint } from '../interfaces/examBlueprint.interface';

export class BlueprintController {
  // Get all blueprints
  async getBlueprints(req: Request, res: Response): Promise<void> {
    try {
      const { examId } = req.query;
      
      let blueprints: IExamBlueprint[] = [];
      try {
        const query: any = {};
        if (examId) query.examId = examId;
        blueprints = await ExamBlueprint.find(query).exec();
      } catch (err) {
        console.warn('Mongoose query failed, falling back to dbStore:', err);
        blueprints = await dbStore.getExamBlueprints();
        if (examId) {
          blueprints = blueprints.filter(b => b.examId === examId);
        }
      }

      res.status(200).json({ success: true, data: blueprints });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create blueprint (Stub)
  async createBlueprint(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, error: 'Creation is managed automatically by the Content Ingestion Parser.' });
  }

  // Update blueprint (Stub)
  async updateBlueprint(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, error: 'Updates are managed automatically by the Content Ingestion Parser.' });
  }

  // Delete blueprint (Stub)
  async deleteBlueprint(req: Request, res: Response): Promise<void> {
    res.status(501).json({ success: false, error: 'Deletion is managed automatically by the Content Ingestion Parser.' });
  }

  // Generate question from blueprint rule (test generate)
  async testGenerate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      let blueprint: IExamBlueprint | null = null;
      try {
        blueprint = await ExamBlueprint.findOne({ id }).exec();
      } catch (err) {
        console.warn('Mongoose query failed, searching dbStore:', err);
      }

      if (!blueprint) {
        const all = await dbStore.getExamBlueprints();
        blueprint = all.find(b => b.id === id) || null;
      }

      if (!blueprint || !blueprint.questions || blueprint.questions.length === 0) {
        res.status(404).json({ success: false, error: 'Blueprint or questions not found' });
        return;
      }

      // Route the first question for test generate
      const generated = await routerService.route(blueprint.questions[0]);
      res.status(200).json({ success: true, data: generated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const blueprintController = new BlueprintController();
