import { body, param, query } from 'express-validator';

export const createStudentValidator = [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isString()
    .withMessage('First name must be a string')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .trim(),

  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isString()
    .withMessage('Last name must be a string')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .trim(),

  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),

  body('dateOfBirth')
    .optional()
    .isString()
    .withMessage('Date of birth must be a string')
    .trim(),

  body('age')
    .notEmpty()
    .withMessage('Age is required')
    .isInt({ min: 3, max: 18 })
    .withMessage('Age must be between 3 and 18'),

  body('classId')
    .notEmpty()
    .withMessage('Class reference is required')
    .isMongoId()
    .withMessage('Invalid class ID'),

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
];

export const updateStudentValidator = [
  param('id')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID'),

  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .trim(),

  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .trim(),

  body('gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),

  body('dateOfBirth')
    .optional()
    .isString()
    .withMessage('Date of birth must be a string')
    .trim(),

  body('age')
    .optional()
    .isInt({ min: 3, max: 18 })
    .withMessage('Age must be between 3 and 18'),

  body('classId')
    .optional()
    .isMongoId()
    .withMessage('Invalid class ID'),

  body('teacherId')
    .optional()
    .isMongoId()
    .withMessage('Invalid teacher ID'),

  body('schoolId')
    .optional()
    .isMongoId()
    .withMessage('Invalid school ID'),
];

export const studentIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID'),
];

export const classIdParamValidator = [
  param('classId')
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

export const getAllStudentsValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
