import { User, UserRole } from '../types';

export interface RosterFilter {
  schoolId: string | null;
  classGroup: string | null;
  section: string | null;
}

interface RosterEntry {
  schoolId: string;
  classGroup: string;
  section: string;
}

const STORAGE_PREFIX = 'fln_roster_filter:v1';

function getScopeSignature(user: User): string {
  if (user.role === UserRole.VOLUNTEER) {
    const assignedSchools = [...new Set(user.assignedSchools || [])].sort();
    return `schools:${assignedSchools.join(',') || 'none'}`;
  }

  if (user.schoolId) return `school:${user.schoolId}`;
  return 'server-scoped';
}

export function getRosterFilterStorageKey(user: User): string {
  return `${STORAGE_PREFIX}:${user.id}:${user.role}:${getScopeSignature(user)}`;
}

export function getDefaultRosterFilter(user: User): RosterFilter {
  return {
    schoolId: user.role === UserRole.TEACHER || user.role === UserRole.SCHOOL ? user.schoolId || null : null,
    classGroup: null,
    section: null,
  };
}

function isRosterFilter(value: unknown): value is RosterFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Record<string, unknown>;
  return (typeof filter.schoolId === 'string' || filter.schoolId === null)
    && (typeof filter.classGroup === 'string' || filter.classGroup === null)
    && (typeof filter.section === 'string' || filter.section === null);
}

export function readRosterFilter(storageKey: string): RosterFilter | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const filter: unknown = JSON.parse(raw);
    return isRosterFilter(filter) ? filter : null;
  } catch {
    return null;
  }
}

export function writeRosterFilter(storageKey: string, filter: RosterFilter): void {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(filter));
  } catch {
    // Storage can be unavailable in private browsing or when it is disabled.
  }
}

export function clearRosterFilter(storageKey: string): void {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in private browsing or when it is disabled.
  }
}

export function isRosterFilterAvailable(filter: RosterFilter, entries: RosterEntry[]): boolean {
  if (filter.schoolId && !entries.some(entry => entry.schoolId === filter.schoolId)) return false;

  if (filter.classGroup === null && filter.section === null) return true;
  if (filter.classGroup === null || filter.section === null) return false;

  return entries.some(entry =>
    (!filter.schoolId || entry.schoolId === filter.schoolId)
    && entry.classGroup === filter.classGroup
    && entry.section === filter.section
  );
}
