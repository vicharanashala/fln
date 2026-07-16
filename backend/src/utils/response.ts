import { Response } from 'express';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
}

export function sendError(res: Response, message: string, statusCode = 500): void {
  const response: ApiResponse = {
    success: false,
    message,
    data: null,
  };
  res.status(statusCode).json(response);
}
