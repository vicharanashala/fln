import { Request, Response, NextFunction } from 'express';
import { StudentService } from '../../services/student/student.service';
import { sendSuccess } from '../../utils/response';
import httpStatus from 'http-status';

const studentService = new StudentService();

export class StudentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.create(req.body);
      sendSuccess(res, 'Student created successfully', student, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const students = await studentService.getAll(includeInactive);
      sendSuccess(res, 'Students fetched successfully', students);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.getById(req.params.id);
      sendSuccess(res, 'Student fetched successfully', student);
    } catch (error) {
      next(error);
    }
  }

  async getByClass(req: Request, res: Response, next: NextFunction) {
    try {
      const students = await studentService.getByClass(req.params.classId);
      sendSuccess(res, 'Students fetched successfully', students);
    } catch (error) {
      next(error);
    }
  }

  async getByTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const students = await studentService.getByTeacher(req.params.teacherId);
      sendSuccess(res, 'Students fetched successfully', students);
    } catch (error) {
      next(error);
    }
  }

  async getBySchool(req: Request, res: Response, next: NextFunction) {
    try {
      const students = await studentService.getBySchool(req.params.schoolId);
      sendSuccess(res, 'Students fetched successfully', students);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.update(req.params.id, req.body);
      sendSuccess(res, 'Student updated successfully', student);
    } catch (error) {
      next(error);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.toggleStatus(req.params.id);
      sendSuccess(res, 'Student status updated successfully', student);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await studentService.delete(req.params.id);
      sendSuccess(res, 'Student deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await studentService.softDelete(req.params.id);
      sendSuccess(res, 'Student deactivated successfully', student);
    } catch (error) {
      next(error);
    }
  }
}
