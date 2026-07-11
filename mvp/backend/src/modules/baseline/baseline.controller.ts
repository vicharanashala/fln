import type { Request, Response } from 'express';
import { baselineService } from '../../modules/baseline/baseline.service.js';
import { evaluationService } from '../../modules/evaluation/evaluation.service.js';
import { streamBaselineZip } from '../../modules/baseline/zip.service.js';

export const baselineController = {
  async generate(req: Request, res: Response) {
    res.status(201).json(await baselineService.generateForClass(req.user!));
  },
  async status(req: Request, res: Response) {
    res.json(await baselineService.status(req.user!));
  },
  async getTest(req: Request, res: Response) {
    res.json(await baselineService.getTestForPreview(req.params.id, req.user!));
  },
  async downloadZip(req: Request, res: Response) {
    await streamBaselineZip(req.user!, res);
  },
  async evaluate(req: Request, res: Response) {
    const report = await evaluationService.evaluate(req.params.studentId, req.body.answers, req.user!);
    res.status(201).json(report);
  },
  async report(req: Request, res: Response) {
    res.json(await evaluationService.getReport(req.params.studentId, req.user!));
  },
};
