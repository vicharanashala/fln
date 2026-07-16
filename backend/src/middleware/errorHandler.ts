import { Request, Response, NextFunction } from 'express';

/**
 * Global Error Handling Middleware for Express
 * Specifically formats MongoDB/Mongoose errors.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // 2. Mongoose ValidationError (Schema validation failed)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    // Extract exact field errors and combine them into a single string
    const errors = Object.values(err.errors).map((el: any) => el.message);
    message = `Invalid input data: ${errors.join('. ')}`;
  }

  // 3. MongoServerError code 11000 (Duplicate Key)
  else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value entered';
  }

  // 4. Any other Database connection/query errors (clean 500)
  // Ensure we don't expose raw DB logs or stack traces in production
  else if (statusCode === 500) {
    // We can log the raw error for internal debugging
    console.error('ERROR 💥:', err);
    message = 'Something went very wrong on the server!';
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    // Provide stack trace only in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
