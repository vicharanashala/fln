import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to catch rejected promises 
 * and pass the error to the Express next() function.
 */
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
