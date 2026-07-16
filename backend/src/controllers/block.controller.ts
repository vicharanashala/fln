import { Request, Response, NextFunction } from 'express';
import { BlockService } from '../services/block.service';
import { sendSuccess } from '../utils/response';
import httpStatus from 'http-status';

const blockService = new BlockService();

export class BlockController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.create(req.body);
      sendSuccess(res, 'Block created successfully', block, httpStatus.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.getById(req.params.id);
      sendSuccess(res, 'Block fetched successfully', block);
    } catch (error) {
      next(error);
    }
  }

  async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.getByCode(req.params.code);
      sendSuccess(res, 'Block fetched successfully', block);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const blocks = await blockService.getAll(includeInactive);
      sendSuccess(res, 'Blocks fetched successfully', blocks);
    } catch (error) {
      next(error);
    }
  }

  async getByDistrict(req: Request, res: Response, next: NextFunction) {
    try {
      const blocks = await blockService.getByDistrict(req.params.districtId);
      sendSuccess(res, 'Blocks fetched successfully', blocks);
    } catch (error) {
      next(error);
    }
  }

  async getByState(req: Request, res: Response, next: NextFunction) {
    try {
      const blocks = await blockService.getByState(req.params.stateId);
      sendSuccess(res, 'Blocks fetched successfully', blocks);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.update(req.params.id, req.body);
      sendSuccess(res, 'Block updated successfully', block);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await blockService.delete(req.params.id);
      sendSuccess(res, 'Block deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.softDelete(req.params.id);
      sendSuccess(res, 'Block deactivated successfully', block);
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await blockService.restore(req.params.id);
      sendSuccess(res, 'Block restored successfully', block);
    } catch (error) {
      next(error);
    }
  }
}
