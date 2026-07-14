import { Request, Response, NextFunction } from 'express';
import { TeacherService } from '../services/teacher.service';
import { sendSuccess } from '../utils/response';
import httpStatus from 'http-status';

const teacherService = new TeacherService();

export class TeacherController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.create(req.body);
      sendSuccess(res, 'Teacher created successfully', teacher, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await teacherService.login(email, password);
      sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.teacherId;
      if (!teacherId) {
        return sendSuccess(res, 'Unauthorized', null, httpStatus.UNAUTHORIZED);
      }
      const dashboard = await teacherService.getDashboard(teacherId);
      sendSuccess(res, 'Dashboard data fetched successfully', dashboard);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.getById(req.params.id);
      sendSuccess(res, 'Teacher fetched successfully', teacher);
    } catch (error) {
      next(error);
    }
  }

  async getByTeacherId(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.getByTeacherId(req.params.teacherId);
      sendSuccess(res, 'Teacher fetched successfully', teacher);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const teachers = await teacherService.getAll(includeInactive);
      sendSuccess(res, 'Teachers fetched successfully', teachers);
    } catch (error) {
      next(error);
    }
  }

  async getBySchool(req: Request, res: Response, next: NextFunction) {
    try {
      const teachers = await teacherService.getBySchool(req.params.schoolId);
      sendSuccess(res, 'Teachers fetched successfully', teachers);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.update(req.params.id, req.body);
      sendSuccess(res, 'Teacher updated successfully', teacher);
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.toggleStatus(req.params.id);
      sendSuccess(res, 'Teacher status updated successfully', teacher);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await teacherService.delete(req.params.id);
      sendSuccess(res, 'Teacher deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const teacher = await teacherService.softDelete(req.params.id);
      sendSuccess(res, 'Teacher deactivated successfully', teacher);
    } catch (error) {
      next(error);
    }
  }
}
