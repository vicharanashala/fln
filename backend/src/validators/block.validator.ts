import { body, param, query } from 'express-validator';

export const createBlockValidator = [
  body('name')
    .notEmpty()
    .withMessage('Block name is required')
    .isString()
    .withMessage('Block name must be a string')
    .isLength({ max: 100 })
    .withMessage('Block name cannot exceed 100 characters')
    .trim(),

  body('code')
    .notEmpty()
    .withMessage('Block code is required')
    .isString()
    .withMessage('Block code must be a string')
    .isLength({ min: 2, max: 20 })
    .withMessage('Block code must be 2 to 20 characters')
    .isUppercase()
    .withMessage('Block code must be uppercase')
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

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateBlockValidator = [
  param('id')
    .notEmpty()
    .withMessage('Block ID is required')
    .isMongoId()
    .withMessage('Invalid block ID'),

  body('name')
    .optional()
    .isString()
    .withMessage('Block name must be a string')
    .isLength({ max: 100 })
    .withMessage('Block name cannot exceed 100 characters')
    .trim(),

  body('code')
    .optional()
    .isString()
    .withMessage('Block code must be a string')
    .isLength({ min: 2, max: 20 })
    .withMessage('Block code must be 2 to 20 characters')
    .isUppercase()
    .withMessage('Block code must be uppercase')
    .trim(),

  body('state')
    .optional()
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('district')
    .optional()
    .isMongoId()
    .withMessage('Invalid district ID'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const blockIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('Block ID is required')
    .isMongoId()
    .withMessage('Invalid block ID'),
];

export const blockCodeValidator = [
  param('code')
    .notEmpty()
    .withMessage('Block code is required')
    .isString()
    .withMessage('Block code must be a string')
    .trim(),
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

export const getAllBlocksValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
