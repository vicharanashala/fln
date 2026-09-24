import { useCallback, useState } from 'react';

export interface RosterFilterState {
  schoolId: string | null;
  classId: string | null;
  classGroup: string | null;
  section: string | null;
}

export const ROSTER_FILTERS_DEFAULT: RosterFilterState = {
  schoolId: null,
  classId: null,
  classGroup: null,
  section: null,
};

export const ROSTER_FILTERS_KEY_PREFIX = 'fln_roster_filter';

export function rosterFiltersKey(userId: string, role: string): string {
  return `${ROSTER_FILTERS_KEY_PREFIX}:${userId}:${role}`;
}

function readStored(userId: string, role: string): RosterFilterState | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(rosterFiltersKey(userId, role));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RosterFilterState>;
    if (parsed === null || typeof parsed !== 'object') return null;
    return {
      schoolId: typeof parsed.schoolId === 'string' ? parsed.schoolId : null,
      classId: typeof parsed.classId === 'string' ? parsed.classId : null,
      classGroup: typeof parsed.classGroup === 'string' ? parsed.classGroup : null,
      section: typeof parsed.section === 'string' ? parsed.section : null,
    };
  } catch {
    return null;
  }
}

function clearStored(userId: string, role: string): void {
  try {
    window.sessionStorage.removeItem(rosterFiltersKey(userId, role));
  } catch {
    // ignored
  }
}

export function useRosterFilters(userId: string, role: string) {
  const [filters, setFilters] = useState<RosterFilterState>(() => readStored(userId, role) ?? ROSTER_FILTERS_DEFAULT);

  const [scopeKey, setScopeKey] = useState(() => rosterFiltersKey(userId, role));
  const nextScopeKey = rosterFiltersKey(userId, role);
  if (nextScopeKey !== scopeKey) {
    setScopeKey(nextScopeKey);
    setFilters(readStored(userId, role) ?? ROSTER_FILTERS_DEFAULT);
  }

  const setFilter = useCallback(
    (fragment: Partial<RosterFilterState>) => {
      setFilters(prev => {
        const next = { ...prev, ...fragment };
        try {
          window.sessionStorage.setItem(rosterFiltersKey(userId, role), JSON.stringify(next));
        } catch {
          // ignored
        }
        return next;
      });
    },
    [userId, role],
  );

  const resetFilters = useCallback(() => {
    setFilters(ROSTER_FILTERS_DEFAULT);
    clearStored(userId, role);
  }, [userId, role]);

  return { filters, setFilter, resetFilters };
}