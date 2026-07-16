import { Request, Response, NextFunction } from 'express';

/**
 * Global Error Handling Middleware for Express.
 * Specifically detects and gracefully formats Mongoose/MongoDB operational exceptions.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format or path';
  } 
  // 2. Mongoose ValidationError (Schema constraint violations)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    // Extract exact field errors and combine them into a single string
    const errors = Object.values(err.errors).map((el: any) => el.message);
    message = `Invalid input data: ${errors.join('. ')}`;
  } 
  // 3. MongoServerError code 11000 (Duplicate Key Error)
  else if (err.code === 11000) {
    statusCode = 409;
    // Extract the field that caused the duplicate key error
    const duplicateField = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate ${duplicateField} value entered. Please use a unique value.`;
  } 
  // 4. Fallback Case (Database queries, connectivity timeouts, generic errors)
  else if (statusCode === 500) {
    // Securely log the error on the server
    console.error('SERVER ERROR 💥:', err);
    // Keep client response generic to avoid leaking raw DB trace details
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    // Provide stack trace only in development environment
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
