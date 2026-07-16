import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import httpStatus from 'http-status';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: messages.join(', '),
      data: null,
      errors: errors.array(),
    });
    return;
  }
  next();
}
