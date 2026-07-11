import { Router } from 'express';
import { authenticate, requireRole } from '../../core/middleware/auth.js';
import { validateBody } from '../../core/middleware/validate.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { studentController } from '../../modules/students/student.controller.js';
import { UserRole } from '../../shared/enums.js';
import { createStudentSchema, updateStudentSchema } from '../../modules/students/student.validators.js';

const router = Router();

// All student routes are teacher-scoped.
router.use(authenticate, requireRole(UserRole.TEACHER));

router.get('/', asyncHandler(studentController.list));
router.post('/', validateBody(createStudentSchema), asyncHandler(studentController.create));
router.get('/:id', asyncHandler(studentController.get));
router.put('/:id', validateBody(updateStudentSchema), asyncHandler(studentController.update));
router.delete('/:id', asyncHandler(studentController.remove));

export default router;
