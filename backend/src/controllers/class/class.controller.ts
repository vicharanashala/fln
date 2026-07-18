import { Request, Response, NextFunction } from 'express';
import { ClassService } from '../../services/class/class.service';
import { sendSuccess } from '../../utils/response';
import httpStatus from 'http-status';

const classService = new ClassService();

export class ClassController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const cls = await classService.create(req.body);
      sendSuccess(res, 'Class created successfully', cls, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const classes = await classService.getAll(includeInactive);
      sendSuccess(res, 'Classes fetched successfully', classes);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const cls = await classService.getById(req.params.id);
      sendSuccess(res, 'Class fetched successfully', cls);
    } catch (error) {
      next(error);
    }
  }

  async getByTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const classes = await classService.getByTeacher(req.params.teacherId);
      sendSuccess(res, 'Classes fetched successfully', classes);
    } catch (error) {
      next(error);
    }
  }

  async getBySchool(req: Request, res: Response, next: NextFunction) {
    try {
      const classes = await classService.getBySchool(req.params.schoolId);
      sendSuccess(res, 'Classes fetched successfully', classes);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const cls = await classService.update(req.params.id, req.body);
      sendSuccess(res, 'Class updated successfully', cls);
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const cls = await classService.toggleStatus(req.params.id);
      sendSuccess(res, 'Class status updated successfully', cls);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await classService.delete(req.params.id);
      sendSuccess(res, 'Class deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const cls = await classService.softDelete(req.params.id);
      sendSuccess(res, 'Class deactivated successfully', cls);
    } catch (error) {
      next(error);
    }
  }
}
