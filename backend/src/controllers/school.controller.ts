import { Request, Response, NextFunction } from 'express';
import { SchoolService } from '../services/school.service';
import { sendSuccess } from '../utils/response';
import httpStatus from 'http-status';

const schoolService = new SchoolService();

export class SchoolController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.create(req.body);
      sendSuccess(res, 'School created successfully', school, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.getById(req.params.id);
      sendSuccess(res, 'School fetched successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.getByCode(req.params.code);
      sendSuccess(res, 'School fetched successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const schools = await schoolService.getAll(includeInactive);
      sendSuccess(res, 'Schools fetched successfully', schools);
    } catch (error) {
      next(error);
    }
  }

  async getByBlock(req: Request, res: Response, next: NextFunction) {
    try {
      const schools = await schoolService.getByBlock(req.params.blockId);
      sendSuccess(res, 'Schools fetched successfully', schools);
    } catch (error) {
      next(error);
    }
  }

  async getByDistrict(req: Request, res: Response, next: NextFunction) {
    try {
      const schools = await schoolService.getByDistrict(req.params.districtId);
      sendSuccess(res, 'Schools fetched successfully', schools);
    } catch (error) {
      next(error);
    }
  }

  async getByState(req: Request, res: Response, next: NextFunction) {
    try {
      const schools = await schoolService.getByState(req.params.stateId);
      sendSuccess(res, 'Schools fetched successfully', schools);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.update(req.params.id, req.body);
      sendSuccess(res, 'School updated successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await schoolService.delete(req.params.id);
      sendSuccess(res, 'School deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.softDelete(req.params.id);
      sendSuccess(res, 'School deactivated successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.restore(req.params.id);
      sendSuccess(res, 'School restored successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async lockAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.lockAccess(req.params.id);
      sendSuccess(res, 'School access locked successfully', school);
    } catch (error) {
      next(error);
    }
  }

  async unlockAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.unlockAccess(req.params.id);
      sendSuccess(res, 'School access unlocked successfully', school);
    } catch (error) {
      next(error);
    }
  }
}
