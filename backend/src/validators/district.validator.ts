import { body, param, query } from 'express-validator';

export const createDistrictValidator = [
  body('name')
    .notEmpty()
    .withMessage('District name is required')
    .isString()
    .withMessage('District name must be a string')
    .isLength({ max: 100 })
    .withMessage('District name cannot exceed 100 characters')
    .trim(),

  body('code')
    .notEmpty()
    .withMessage('District code is required')
    .isString()
    .withMessage('District code must be a string')
    .isLength({ min: 2, max: 10 })
    .withMessage('District code must be 2 to 10 characters')
    .isUppercase()
    .withMessage('District code must be uppercase')
    .trim(),

  body('state')
    .notEmpty()
    .withMessage('State reference is required')
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateDistrictValidator = [
  param('id')
    .notEmpty()
    .withMessage('District ID is required')
    .isMongoId()
    .withMessage('Invalid district ID'),

  body('name')
    .optional()
    .isString()
    .withMessage('District name must be a string')
    .isLength({ max: 100 })
    .withMessage('District name cannot exceed 100 characters')
    .trim(),

  body('code')
    .optional()
    .isString()
    .withMessage('District code must be a string')
    .isLength({ min: 2, max: 10 })
    .withMessage('District code must be 2 to 10 characters')
    .isUppercase()
    .withMessage('District code must be uppercase')
    .trim(),

  body('state')
    .optional()
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const districtIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('District ID is required')
    .isMongoId()
    .withMessage('Invalid district ID'),
];

export const districtCodeValidator = [
  param('code')
    .notEmpty()
    .withMessage('District code is required')
    .isString()
    .withMessage('District code must be a string')
    .trim(),
];

export const stateIdParamValidator = [
  param('stateId')
    .notEmpty()
    .withMessage('State ID is required')
    .isMongoId()
    .withMessage('Invalid state ID'),
];

export const getAllDistrictsValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
