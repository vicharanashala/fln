import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
// Assume you have a Mongoose model imported here
// import { User } from '../models/User';

/**
 * Example controller for getting a document by ID.
 * Wrapped with catchAsync to automatically catch rejected promises.
 */
export const getUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // This will throw a Mongoose CastError if 'id' is not a valid ObjectId format,
  // which is then caught by catchAsync and passed to the errorHandler (yielding 400).
  // const user = await User.findById(id);
  
  // Custom 404 logic (if you have a custom AppError class, you can throw it here)
  // if (!user) {
  //   throw new Error('User not found'); // Needs custom AppError for proper status codes
  // }

  res.status(200).json({
    status: 'success',
    data: {
      // user
      id
    }
  });
});

/**
 * Example controller for creating a new document.
 * Wrapped with catchAsync.
 */
export const createUser = catchAsync(async (req: Request, res: Response) => {
  // This will throw a ValidationError if required fields are missing,
  // or a MongoServerError (11000) if a unique constraint is violated.
  // Both are handled gracefully by our global error handler middleware.
  // const newUser = await User.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      // user: newUser
      message: 'User created successfully'
    }
  });
});
