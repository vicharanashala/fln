import { Router } from 'express';
import { authenticate, requireRole } from '../../core/middleware/auth.js';
import { validateBody } from '../../core/middleware/validate.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { authController } from '../../modules/auth/auth.controller.js';
import { UserRole } from '../../shared/enums.js';
import { createTeacherSchema, loginSchema } from '../../modules/auth/auth.validators.js';

const router = Router();

router.post('/login', validateBody(loginSchema), asyncHandler(authController.login));
router.get('/me', authenticate, authController.me);

// Superadmin-only teacher provisioning
router.post(
  '/teachers',
  authenticate,
  requireRole(UserRole.SUPERADMIN),
  validateBody(createTeacherSchema),
  asyncHandler(authController.createTeacher)
);
router.get('/teachers', authenticate, requireRole(UserRole.SUPERADMIN), asyncHandler(authController.listTeachers));

export default router;
