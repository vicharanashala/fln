import { useCallback, useEffect, useState } from 'react';

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

/** The minimum a student row needs to take part in a school-scope check. */
export interface RosterScopeRow {
  schoolId: string | null;
  classGroup: string;
  section: string;
}

/**
 * Issue #532: does this saved selection still belong to the school that is
 * actually on screen?
 *
 * A filter saved for one school must never be re-applied to another. Roles
 * differ in what "the current school" even means — a teacher's or volunteer's
 * dashboard is single-school, so the check is against their own schoolId,
 * while an admin/superadmin roster spans many schools at once and has no
 * single current school. Callers pass the school they are scoped to here; a
 * saved selection with no schoolId ("All Students") always applies.
 */
export function savedRosterAppliesToSchool(
  saved: Pick<RosterFilterState, 'schoolId'>,
  currentSchoolId: string | null,
): boolean {
  return saved.schoolId === null || saved.schoolId === currentSchoolId;
}

/**
 * Issue #532: the class tab to restore for a saved selection, or null when
 * the saved selection must not be restored.
 *
 * Tabs are keyed `classGroup|section`, which is not unique across schools, so
 * matching on the key alone would happily restore a class belonging to a
 * different school (a reassigned volunteer, or an admin who switched school
 * scope) onto an identically named tab. The saved schoolId is what narrows
 * it: the tab only restores when a student in that exact class still belongs
 * to the saved school.
 */
export function resolveRestoredClassTab(
  saved: RosterFilterState,
  rows: readonly RosterScopeRow[],
): string | null {
  const { classGroup, section, schoolId } = saved;
  if (!classGroup || !section) return null;
  const key = `${classGroup}|${section}`;
  const inKey = (r: RosterScopeRow) => `${r.classGroup}|${r.section}` === key;
  if (!rows.some(inKey)) return null;
  // "All Students" is not school-specific, so it needs no further scoping.
  if (schoolId === null) return key;
  return rows.some(r => r.schoolId === schoolId && inKey(r)) ? key : null;
}

export function useRosterFilters(userId: string, role: string) {
  const [filters, setFilters] = useState<RosterFilterState>(() => readStored(userId, role) ?? ROSTER_FILTERS_DEFAULT);

  const [scopeKey, setScopeKey] = useState(() => rosterFiltersKey(userId, role));
  // Issue #532: re-read the stored selection when the scope (user + role)
  // changes. This deliberately lives in an effect rather than inline in the
  // render body — calling setScopeKey/setFilters while rendering means React
  // has already produced a render using the *previous* scope's filters before
  // it discards that output, so a scope switch can briefly render (and
  // fetch with) another user's or another role's class selection. Keeping
  // scopeKey in state lets the comparison happen without re-reading
  // sessionStorage on renders that did not change scope.
  useEffect(() => {
    const nextScopeKey = rosterFiltersKey(userId, role);
    if (nextScopeKey !== scopeKey) {
      setScopeKey(nextScopeKey);
      setFilters(readStored(userId, role) ?? ROSTER_FILTERS_DEFAULT);
    }
  }, [userId, role, scopeKey]);

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