import { CLASS_LEVEL_RANGES } from '@fln/curriculum';
import { canAccessClass } from '../access';
import { HttpError } from '../http';
import type { Repos } from '../repos';
import type { ClassGroup, User } from '../types';

export type ClassName = keyof typeof CLASS_LEVEL_RANGES;
export const CLASS_NAMES = Object.keys(CLASS_LEVEL_RANGES) as ClassName[];
export function isClassName(v: unknown): v is ClassName { return typeof v === 'string' && (CLASS_NAMES as string[]).includes(v); }

/** Loads a class and checks that this user may use it: 404 when it is missing, 403 when it is not theirs. */
export async function loadClass(repos: Repos, id: string, user: User): Promise<ClassGroup> {
  const cls = await repos.classes.byId(id);
  if (!cls) throw new HttpError(404, 'Class not found.');
  if (!canAccessClass(user, cls)) throw new HttpError(403, 'Forbidden');
  return cls;
}

/** The first and last curriculum level of a class, or undefined for a name that is not a class. */
export function levelRange(className: string): readonly [number, number] | undefined {
  return isClassName(className) ? CLASS_LEVEL_RANGES[className] : undefined;
}
