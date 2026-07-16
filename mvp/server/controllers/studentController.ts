import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { Student } from '../models/Student'; // Your Mongoose model

/**
 * Fetch a student by their ID.
 * Wrapped in catchAsync, so any DB promise rejection goes straight to our errorHandler.
 */
export const getStudent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // A malformed ObjectId here throws a CastError, automatically handled by the middleware.
  const student = await Student.findById(id);
  
  // Custom 404 handling logic for when the query succeeds but finds nothing
  if (!student) {
    const error: any = new Error('No student found with that ID');
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json({
    status: 'success',
    data: {
      student
    }
  });
});

/**
 * Create a new student.
 */
export const createStudent = catchAsync(async (req: Request, res: Response) => {
  // If email is duplicate, it triggers a 11000 MongoServerError.
  // If required fields are missing, it triggers a ValidationError.
  const newStudent = await Student.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      student: newStudent
    }
  });
});
