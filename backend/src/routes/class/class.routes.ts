import { Router } from 'express';
import { ClassController } from '../../controllers/class/class.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import {
  createClassValidator,
  updateClassValidator,
  classIdValidator,
  teacherIdParamValidator,
  schoolIdParamValidator,
  getAllClassesValidator,
} from '../../validators/class/class.validator';

const router = Router();
const controller = new ClassController();

router
  .route('/')
  .get(getAllClassesValidator, validate, controller.getAll)
  .post(authenticate, createClassValidator, validate, controller.create);

router
  .route('/teacher/:teacherId')
  .get(teacherIdParamValidator, validate, controller.getByTeacher);

router
  .route('/school/:schoolId')
  .get(schoolIdParamValidator, validate, controller.getBySchool);

router
  .route('/:id')
  .get(classIdValidator, validate, controller.getById)
  .put(authenticate, updateClassValidator, validate, controller.update)
  .delete(authenticate, classIdValidator, validate, controller.delete);

router
  .route('/:id/status')
  .patch(authenticate, classIdValidator, validate, controller.toggleStatus);

router
  .route('/:id/deactivate')
  .patch(authenticate, classIdValidator, validate, controller.softDelete);

export default router;
