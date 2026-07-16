import { Request, Response, NextFunction } from 'express';

/**
 * Higher-order function that wraps an asynchronous Express route handler.
 * It automatically catches any rejected promises and forwards the exception
 * using next(err), eliminating boilerplate try-catch blocks.
 */
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
