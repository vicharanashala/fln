import { Router } from 'express';
import { BlockController } from '../controllers/block.controller';
import { validate } from '../middlewares/validate';
import {
  createBlockValidator,
  updateBlockValidator,
  blockIdValidator,
  blockCodeValidator,
  districtIdParamValidator,
  stateIdParamValidator,
  getAllBlocksValidator,
} from '../validators/block.validator';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';

const router = Router();
const controller = new BlockController();

router
  .route('/')
  .get(getAllBlocksValidator, validate, controller.getAll)
  .post(authenticate, authorize('superadmin', 'admin'), createBlockValidator, validate, controller.create);

router
  .route('/by-state/:stateId')
  .get(stateIdParamValidator, validate, controller.getByState);

router
  .route('/by-district/:districtId')
  .get(districtIdParamValidator, validate, controller.getByDistrict);

router
  .route('/code/:code')
  .get(blockCodeValidator, validate, controller.getByCode);

router
  .route('/:id')
  .get(blockIdValidator, validate, controller.getById)
  .patch(authenticate, authorize('superadmin', 'admin'), updateBlockValidator, validate, controller.update)
  .delete(authenticate, authorize('superadmin'), blockIdValidator, validate, controller.delete);

router
  .route('/:id/deactivate')
  .patch(authenticate, authorize('superadmin', 'admin'), blockIdValidator, validate, controller.softDelete);

router
  .route('/:id/restore')
  .patch(authenticate, authorize('superadmin', 'admin'), blockIdValidator, validate, controller.restore);

export default router;
