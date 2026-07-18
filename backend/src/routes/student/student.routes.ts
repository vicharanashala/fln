import { Router } from 'express';
import { StudentController } from '../../controllers/student/student.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import {
  createStudentValidator,
  updateStudentValidator,
  studentIdValidator,
  classIdParamValidator,
  teacherIdParamValidator,
  schoolIdParamValidator,
  getAllStudentsValidator,
} from '../../validators/student/student.validator';

const router = Router();
const controller = new StudentController();

router
  .route('/')
  .get(getAllStudentsValidator, validate, controller.getAll)
  .post(authenticate, createStudentValidator, validate, controller.create);

router
  .route('/class/:classId')
  .get(classIdParamValidator, validate, controller.getByClass);

router
  .route('/teacher/:teacherId')
  .get(teacherIdParamValidator, validate, controller.getByTeacher);

router
  .route('/school/:schoolId')
  .get(schoolIdParamValidator, validate, controller.getBySchool);

router
  .route('/:id')
  .get(studentIdValidator, validate, controller.getById)
  .put(authenticate, updateStudentValidator, validate, controller.update)
  .delete(authenticate, studentIdValidator, validate, controller.delete);

router
  .route('/:id/status')
  .patch(authenticate, studentIdValidator, validate, controller.toggleStatus);

router
  .route('/:id/deactivate')
  .patch(authenticate, studentIdValidator, validate, controller.softDelete);

export default router;
