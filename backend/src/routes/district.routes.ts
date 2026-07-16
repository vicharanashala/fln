import { Router } from 'express';
import { DistrictController } from '../controllers/district.controller';
import { validate } from '../middlewares/validate';
import {
  createDistrictValidator,
  updateDistrictValidator,
  districtIdValidator,
  districtCodeValidator,
  stateIdParamValidator,
  getAllDistrictsValidator,
} from '../validators/district.validator';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';

const router = Router();
const controller = new DistrictController();

router
  .route('/')
  .get(getAllDistrictsValidator, validate, controller.getAll)
  .post(authenticate, authorize('superadmin', 'admin'), createDistrictValidator, validate, controller.create);

router
  .route('/by-state/:stateId')
  .get(stateIdParamValidator, validate, controller.getByState);

router
  .route('/code/:code')
  .get(districtCodeValidator, validate, controller.getByCode);

router
  .route('/:id')
  .get(districtIdValidator, validate, controller.getById)
  .patch(authenticate, authorize('superadmin', 'admin'), updateDistrictValidator, validate, controller.update)
  .delete(authenticate, authorize('superadmin'), districtIdValidator, validate, controller.delete);

router
  .route('/:id/deactivate')
  .patch(authenticate, authorize('superadmin', 'admin'), districtIdValidator, validate, controller.softDelete);

router
  .route('/:id/restore')
  .patch(authenticate, authorize('superadmin', 'admin'), districtIdValidator, validate, controller.restore);

export default router;
