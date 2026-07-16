import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = httpStatus.INTERNAL_SERVER_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  if ((err as any).code === 11000) {
    res.status(httpStatus.CONFLICT).json({
      success: false,
      message: 'Duplicate entry',
      data: null,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Invalid ID format',
      data: null,
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'Internal server error',
    data: null,
  });
}
