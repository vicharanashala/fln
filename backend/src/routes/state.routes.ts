import { Router } from 'express';
import { StateController } from '../controllers/state.controller';
import { validate } from '../middlewares/validate';
import {
  createStateValidator,
  updateStateValidator,
  stateIdValidator,
  stateCodeValidator,
  getAllStatesValidator,
} from '../validators/state.validator';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';

const router = Router();
const controller = new StateController();

router
  .route('/')
  .get(getAllStatesValidator, validate, controller.getAll)
  .post(authenticate, authorize('superadmin'), createStateValidator, validate, controller.create);

router
  .route('/code/:code')
  .get(stateCodeValidator, validate, controller.getByCode);

router
  .route('/:id')
  .get(stateIdValidator, validate, controller.getById)
  .patch(authenticate, authorize('superadmin', 'admin'), updateStateValidator, validate, controller.update)
  .delete(authenticate, authorize('superadmin'), stateIdValidator, validate, controller.delete);

router
  .route('/:id/deactivate')
  .patch(authenticate, authorize('superadmin'), stateIdValidator, validate, controller.softDelete);

router
  .route('/:id/restore')
  .patch(authenticate, authorize('superadmin'), stateIdValidator, validate, controller.restore);

export default router;
