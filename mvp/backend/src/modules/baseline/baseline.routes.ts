import { Router } from 'express';
import { authenticate, requireRole } from '../../core/middleware/auth.js';
import { validateBody } from '../../core/middleware/validate.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { baselineController } from '../../modules/baseline/baseline.controller.js';
import { UserRole } from '../../shared/enums.js';
import { evaluateSchema } from '../../modules/baseline/baseline.validators.js';

const router = Router();

router.use(authenticate, requireRole(UserRole.TEACHER));

router.post('/generate', asyncHandler(baselineController.generate));
router.get('/status', asyncHandler(baselineController.status));
router.get('/download', asyncHandler(baselineController.downloadZip));
router.get('/tests/:id', asyncHandler(baselineController.getTest));
router.post('/evaluate/:studentId', validateBody(evaluateSchema), asyncHandler(baselineController.evaluate));
router.get('/report/:studentId', asyncHandler(baselineController.report));

export default router;
