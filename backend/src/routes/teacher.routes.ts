import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import {
  createTeacherValidator,
  loginValidator,
  updateTeacherValidator,
  teacherIdParamValidator,
  teacherObjectIdValidator,
  schoolIdParamValidator,
  getAllTeachersValidator,
} from '../validators/teacher.validator';

const router = Router();
const controller = new TeacherController();

router.post('/login', loginValidator, validate, controller.login);
router.post('/', createTeacherValidator, validate, controller.create);

router.get('/me', authenticate, controller.getDashboard);

router.use(authenticate);

router
  .route('/')
  .get(getAllTeachersValidator, validate, controller.getAll);

router
  .route('/by-school/:schoolId')
  .get(schoolIdParamValidator, validate, controller.getBySchool);

router
  .route('/by-teacher-id/:teacherId')
  .get(teacherIdParamValidator, validate, controller.getByTeacherId);

router
  .route('/:id')
  .get(teacherObjectIdValidator, validate, controller.getById)
  .put(updateTeacherValidator, validate, controller.update)
  .delete(teacherObjectIdValidator, validate, controller.delete);

router
  .route('/:id/status')
  .patch(teacherObjectIdValidator, validate, controller.toggleStatus);

router
  .route('/:id/deactivate')
  .patch(teacherObjectIdValidator, validate, controller.softDelete);

export default router;
