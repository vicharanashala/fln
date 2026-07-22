import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginValidator } from '../validators/teacher.validator';

import { authenticate } from '../middlewares/auth';

const router = Router();
const controller = new AuthController();

router.post('/login', loginValidator, validate, controller.login);
router.get('/me', authenticate, controller.me);

export default router;
