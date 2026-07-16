import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginValidator } from '../validators/teacher.validator';

const router = Router();
const controller = new AuthController();

router.post('/login', loginValidator, validate, controller.login);

export default router;
