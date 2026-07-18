import { body, param, query } from 'express-validator';

export const createTeacherValidator = [
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

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),

  body('school')
    .notEmpty()
    .withMessage('School reference is required')
    .isMongoId()
    .withMessage('Invalid school ID'),

  body('employeeCode')
    .optional()
    .isString()
    .withMessage('Employee code must be a string')
    .trim(),

  body('qualification')
    .optional()
    .isString()
    .withMessage('Qualification must be a string')
    .trim(),

  body('experienceYears')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience years must be a non-negative integer'),
];

export const loginValidator = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

export const updateTeacherValidator = [
  param('id')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isMongoId()
    .withMessage('Invalid teacher ID'),

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

  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('phoneNumber')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),

  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),

  body('school')
    .optional()
    .isMongoId()
    .withMessage('Invalid school ID'),

  body('employeeCode')
    .optional()
    .isString()
    .withMessage('Employee code must be a string')
    .trim(),

  body('qualification')
    .optional()
    .isString()
    .withMessage('Qualification must be a string')
    .trim(),

  body('experienceYears')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience years must be a non-negative integer'),
];

export const teacherIdParamValidator = [
  param('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .matches(/^T\d{6}$/)
    .withMessage('Teacher ID must be in format T000001'),
];

export const teacherObjectIdValidator = [
  param('id')
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

export const getAllTeachersValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
