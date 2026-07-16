import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
        data: null,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: 'You do not have permission to perform this action',
        data: null,
      });
      return;
    }

    next();
  };
}
