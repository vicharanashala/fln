import { Router } from 'express';
import { SchoolController } from '../controllers/school.controller';
import { validate } from '../middlewares/validate';
import {
  createSchoolValidator,
  updateSchoolValidator,
  schoolIdValidator,
  schoolCodeValidator,
  blockIdParamValidator,
  districtIdParamValidator,
  stateIdParamValidator,
  getAllSchoolsValidator,
} from '../validators/school.validator';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';

const router = Router();
const controller = new SchoolController();

router
  .route('/')
  .get(getAllSchoolsValidator, validate, controller.getAll)
  .post(authenticate, authorize('superadmin', 'admin'), createSchoolValidator, validate, controller.create);

router
  .route('/by-state/:stateId')
  .get(stateIdParamValidator, validate, controller.getByState);

router
  .route('/by-district/:districtId')
  .get(districtIdParamValidator, validate, controller.getByDistrict);

router
  .route('/by-block/:blockId')
  .get(blockIdParamValidator, validate, controller.getByBlock);

router
  .route('/code/:code')
  .get(schoolCodeValidator, validate, controller.getByCode);

router
  .route('/:id')
  .get(schoolIdValidator, validate, controller.getById)
  .patch(authenticate, authorize('superadmin', 'admin'), updateSchoolValidator, validate, controller.update)
  .delete(authenticate, authorize('superadmin'), schoolIdValidator, validate, controller.delete);

router
  .route('/:id/deactivate')
  .patch(authenticate, authorize('superadmin', 'admin'), schoolIdValidator, validate, controller.softDelete);

router
  .route('/:id/restore')
  .patch(authenticate, authorize('superadmin', 'admin'), schoolIdValidator, validate, controller.restore);

router
  .route('/:id/lock')
  .patch(authenticate, authorize('superadmin', 'admin'), schoolIdValidator, validate, controller.lockAccess);

router
  .route('/:id/unlock')
  .patch(authenticate, authorize('superadmin', 'admin'), schoolIdValidator, validate, controller.unlockAccess);

export default router;
