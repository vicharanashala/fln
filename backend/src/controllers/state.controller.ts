import { Request, Response, NextFunction } from 'express';
import { StateService } from '../services/state.service';
import httpStatus from 'http-status';
import { sendSuccess } from '../utils/response';

const stateService = new StateService();

export class StateController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.create(req.body);
      sendSuccess(res, 'State created successfully', state, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.getById(req.params.id);
      sendSuccess(res, 'State fetched successfully', state);
    } catch (error) {
      next(error);
    }
  }

  async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.getByCode(req.params.code);
      sendSuccess(res, 'State fetched successfully', state);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const states = await stateService.getAll(includeInactive);
      sendSuccess(res, 'States fetched successfully', states);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.update(req.params.id, req.body);
      sendSuccess(res, 'State updated successfully', state);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await stateService.delete(req.params.id);
      sendSuccess(res, 'State deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.softDelete(req.params.id);
      sendSuccess(res, 'State deactivated successfully', state);
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const state = await stateService.restore(req.params.id);
      sendSuccess(res, 'State restored successfully', state);
    } catch (error) {
      next(error);
    }
  }
}
