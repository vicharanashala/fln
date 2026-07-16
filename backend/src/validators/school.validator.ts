import { body, param, query } from 'express-validator';

export const createSchoolValidator = [
  body('name')
    .notEmpty()
    .withMessage('School name is required')
    .isString()
    .withMessage('School name must be a string')
    .isLength({ max: 200 })
    .withMessage('School name cannot exceed 200 characters')
    .trim(),

  body('code')
    .notEmpty()
    .withMessage('School code is required')
    .isString()
    .withMessage('School code must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('School code must be 3 to 50 characters')
    .isLowercase()
    .withMessage('School code must be lowercase')
    .trim(),

  body('state')
    .notEmpty()
    .withMessage('State reference is required')
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('district')
    .notEmpty()
    .withMessage('District reference is required')
    .isMongoId()
    .withMessage('Invalid district ID'),

  body('block')
    .notEmpty()
    .withMessage('Block reference is required')
    .isMongoId()
    .withMessage('Invalid block ID'),

  body('strength')
    .notEmpty()
    .withMessage('School strength is required')
    .isIn(['high', 'low'])
    .withMessage('Strength must be either "high" or "low"'),

  body('isAccessLocked')
    .optional()
    .isBoolean()
    .withMessage('isAccessLocked must be a boolean'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateSchoolValidator = [
  param('id')
    .notEmpty()
    .withMessage('School ID is required')
    .isMongoId()
    .withMessage('Invalid school ID'),

  body('name')
    .optional()
    .isString()
    .withMessage('School name must be a string')
    .isLength({ max: 200 })
    .withMessage('School name cannot exceed 200 characters')
    .trim(),

  body('code')
    .optional()
    .isString()
    .withMessage('School code must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('School code must be 3 to 50 characters')
    .isLowercase()
    .withMessage('School code must be lowercase')
    .trim(),

  body('state')
    .optional()
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('district')
    .optional()
    .isMongoId()
    .withMessage('Invalid district ID'),

  body('block')
    .optional()
    .isMongoId()
    .withMessage('Invalid block ID'),

  body('strength')
    .optional()
    .isIn(['high', 'low'])
    .withMessage('Strength must be either "high" or "low"'),

  body('isAccessLocked')
    .optional()
    .isBoolean()
    .withMessage('isAccessLocked must be a boolean'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const schoolIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('School ID is required')
    .isMongoId()
    .withMessage('Invalid school ID'),
];

export const schoolCodeValidator = [
  param('code')
    .notEmpty()
    .withMessage('School code is required')
    .isString()
    .withMessage('School code must be a string')
    .trim(),
];

export const blockIdParamValidator = [
  param('blockId')
    .notEmpty()
    .withMessage('Block ID is required')
    .isMongoId()
    .withMessage('Invalid block ID'),
];

export const districtIdParamValidator = [
  param('districtId')
    .notEmpty()
    .withMessage('District ID is required')
    .isMongoId()
    .withMessage('Invalid district ID'),
];

export const stateIdParamValidator = [
  param('stateId')
    .notEmpty()
    .withMessage('State ID is required')
    .isMongoId()
    .withMessage('Invalid state ID'),
];

export const getAllSchoolsValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
