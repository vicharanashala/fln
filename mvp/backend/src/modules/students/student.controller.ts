import type { Request, Response } from 'express';
import { studentService } from '../../modules/students/student.service.js';

export const studentController = {
  async list(req: Request, res: Response) {
    res.json(await studentService.listForTeacher(req.user!));
  },
  async get(req: Request, res: Response) {
    res.json(await studentService.get(req.params.id, req.user!));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await studentService.create(req.body, req.user!));
  },
  async update(req: Request, res: Response) {
    res.json(await studentService.update(req.params.id, req.body, req.user!));
  },
  async remove(req: Request, res: Response) {
    await studentService.remove(req.params.id, req.user!);
    res.status(204).end();
  },
};
