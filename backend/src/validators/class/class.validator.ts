import { body, param, query } from 'express-validator';

export const createClassValidator = [
  body('className')
    .notEmpty()
    .withMessage('Class name is required')
    .isString()
    .withMessage('Class name must be a string')
    .isLength({ max: 50 })
    .withMessage('Class name cannot exceed 50 characters')
    .trim(),

  body('section')
    .notEmpty()
    .withMessage('Section is required')
    .isString()
    .withMessage('Section must be a string')
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters')
    .trim(),

  body('academicYear')
    .notEmpty()
    .withMessage('Academic year is required')
    .isString()
    .withMessage('Academic year must be a string')
    .trim(),

  body('teacherId')
    .notEmpty()
    .withMessage('Teacher reference is required')
    .isMongoId()
    .withMessage('Invalid teacher ID'),

  body('schoolId')
    .notEmpty()
    .withMessage('School reference is required')
    .isMongoId()
    .withMessage('Invalid school ID'),

  body('maximumStudents')
    .notEmpty()
    .withMessage('Maximum students is required')
    .isInt({ min: 1 })
    .withMessage('Maximum students must be a positive integer'),
];

export const updateClassValidator = [
  param('id')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid class ID'),

  body('className')
    .optional()
    .isString()
    .withMessage('Class name must be a string')
    .isLength({ max: 50 })
    .withMessage('Class name cannot exceed 50 characters')
    .trim(),

  body('section')
    .optional()
    .isString()
    .withMessage('Section must be a string')
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters')
    .trim(),

  body('academicYear')
    .optional()
    .isString()
    .withMessage('Academic year must be a string')
    .trim(),

  body('teacherId')
    .optional()
    .isMongoId()
    .withMessage('Invalid teacher ID'),

  body('schoolId')
    .optional()
    .isMongoId()
    .withMessage('Invalid school ID'),

  body('maximumStudents')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum students must be a positive integer'),
];

export const classIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('Class ID is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
];

export const teacherIdParamValidator = [
  param('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID'),
];

export const schoolIdParamValidator = [
  param('schoolId')
    .notEmpty()
    .withMessage('School ID is required')
    .isMongoId()
    .withMessage('Invalid school ID'),
];

export const getAllClassesValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
