import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { authenticate } from '../middlewares/auth';

/**
 * Routes for the Student module.
 *
 * Phase 1 surface area: GET / and POST / only. Both are gated by the
 * existing `authenticate` middleware (which now resolves the `dev-token`
 * dev-bypass to the demo teacher identity thanks to the guard added
 * earlier this session). No new auth code, no new middleware.
 *
 * Mirrors `class.routes.ts` shape exactly: `router.use(authenticate)` once,
 * then the route handlers. No validators for Phase 1 — the controller's
 * service-layer `Missing required student details.` check (legacy parity)
 * handles the same job with the same error message.
 */
const router = Router();
const controller = new StudentController();

router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);

export default router;