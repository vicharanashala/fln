import { Request, Response, NextFunction } from 'express';
import { DistrictService } from '../services/district.service';
import { sendSuccess } from '../utils/response';
import httpStatus from 'http-status';

const districtService = new DistrictService();

export class DistrictController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.create(req.body);
      sendSuccess(res, 'District created successfully', district, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.getById(req.params.id);
      sendSuccess(res, 'District fetched successfully', district);
    } catch (error) {
      next(error);
    }
  }

  async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.getByCode(req.params.code);
      sendSuccess(res, 'District fetched successfully', district);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const districts = await districtService.getAll(includeInactive);
      sendSuccess(res, 'Districts fetched successfully', districts);
    } catch (error) {
      next(error);
    }
  }

  async getByState(req: Request, res: Response, next: NextFunction) {
    try {
      const districts = await districtService.getByState(req.params.stateId);
      sendSuccess(res, 'Districts fetched successfully', districts);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.update(req.params.id, req.body);
      sendSuccess(res, 'District updated successfully', district);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await districtService.delete(req.params.id);
      sendSuccess(res, 'District deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.softDelete(req.params.id);
      sendSuccess(res, 'District deactivated successfully', district);
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const district = await districtService.restore(req.params.id);
      sendSuccess(res, 'District restored successfully', district);
    } catch (error) {
      next(error);
    }
  }
}
