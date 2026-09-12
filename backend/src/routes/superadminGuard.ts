import express from 'express';
import { UserRole } from '../db';
import { getAuthUser } from '../auth';

/**
 * Superadmin-only guard for the curriculum authoring routes.
 *
 * Authoring what a question asks is a curriculum decision, and the 7-role
 * hierarchy has no curriculum-author role, so these routes stop at Superadmin.
 * Shared rather than repeated per route file: two copies drift, and a guard
 * that is 403 in one file and 401 in another is a real access bug.
 *
 * Returns the user, or null after having already sent the 403.
 */
export function requireSuperadmin(
  req: express.Request,
  res: express.Response,
  subject = 'question logics'
) {
  const user = getAuthUser(req);
  if (!user || user.role !== UserRole.SUPERADMIN) {
    res.status(403).json({ error: `Only superadmins can manage ${subject}.` });
    return null;
  }
  return user;
}
