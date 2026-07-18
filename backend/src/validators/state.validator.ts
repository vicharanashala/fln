import { body, param, query } from 'express-validator';

export const createStateValidator = [
  body('name')
    .notEmpty()
    .withMessage('State name is required')
    .isString()
    .withMessage('State name must be a string')
    .isLength({ max: 100 })
    .withMessage('State name cannot exceed 100 characters')
    .trim(),

  body('code')
    .notEmpty()
    .withMessage('State code is required')
    .isString()
    .withMessage('State code must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('State code must be 2 to 5 characters')
    .isUppercase()
    .withMessage('State code must be uppercase')
    .trim(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const updateStateValidator = [
  param('id')
    .notEmpty()
    .withMessage('State ID is required')
    .isMongoId()
    .withMessage('Invalid state ID'),

  body('name')
    .optional()
    .isString()
    .withMessage('State name must be a string')
    .isLength({ max: 100 })
    .withMessage('State name cannot exceed 100 characters')
    .trim(),

  body('code')
    .optional()
    .isString()
    .withMessage('State code must be a string')
    .isLength({ min: 2, max: 5 })
    .withMessage('State code must be 2 to 5 characters')
    .isUppercase()
    .withMessage('State code must be uppercase')
    .trim(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

export const stateIdValidator = [
  param('id')
    .notEmpty()
    .withMessage('State ID is required')
    .isMongoId()
    .withMessage('Invalid state ID'),
];

export const stateCodeValidator = [
  param('code')
    .notEmpty()
    .withMessage('State code is required')
    .isString()
    .withMessage('State code must be a string')
    .trim(),
];

export const getAllStatesValidator = [
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];
