// Builds the printed teacher observation sheet for a class (#618).
//
// Two callers use it: POST /api/observations/sheet (one layout, strict concept list) and
// POST /api/worksheets/generate-concept-batch (both layouts, printed together with the
// worksheet). It reads the class, its roster and the observed concepts, checks who may
// print, and writes nothing except the PDF files.

import { randomUUID } from 'crypto';
import { dbStore, UserRole, CYCLE_NAMES } from '../db';
import type { getAuthUser } from '../auth';
import { getLevelForConcept } from '../config/curriculumMap';
import { OBSERVATION_LAYOUTS, renderObservationSheet } from '../observationSheet';
import type { ObservationLayout } from '../observationSheet';

/** Most children and concepts one printed sheet may carry. */
export const MAX_SHEET_STUDENTS = 120;
export const MAX_SHEET_CONCEPTS = 20;

type AuthUser = NonNullable<ReturnType<typeof getAuthUser>>;

/** Who may read or print a class's observations: wide roles, anyone at the school, or the class teacher. */
export function canAccessClassRecords(user: AuthUser, classGroup: { schoolId: string; teacherId: string }): boolean {
  const hasBroadAccess = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN].includes(user.role);
  const hasSchoolAccess = classGroup.schoolId === user.schoolId || (user.assignedSchools?.includes(classGroup.schoolId) ?? false);
  const isClassTeacher = classGroup.teacherId === user.id;
  return hasBroadAccess || hasSchoolAccess || isClassTeacher;
}

export interface BuiltObservationSheets {
  ok: true;
  sheets: { layout: ObservationLayout; pdfUrl: string; pageCount: number }[];
  studentCount: number;
  concepts: { conceptId: string; level: number }[];
}
export interface ObservationSheetFailure {
  ok: false;
  status: number;
  error: string;
}

/**
 * `requested` is the concept list the caller chose. With `strict` (the sheet route) a
 * concept that is not observed is an error; without it (a worksheet that mixes written and
 * observed concepts) such concepts are left off the sheet, and a worksheet with no observed
 * concept at all gets a 404 the caller can report as "nothing to observe".
 */
export async function buildObservationSheets(
  user: AuthUser,
  input: { classId: string; cycle: string; layouts: ObservationLayout[]; requested?: string[]; strict: boolean },
): Promise<BuiltObservationSheets | ObservationSheetFailure> {
  if (user.role === UserRole.TEACHER && user.isBanned) {
    return { ok: false, status: 403, error: 'Account suspended.' };
  }
  const classGroup = (await dbStore.getClasses()).find(c => c.id === input.classId);
  if (!classGroup) return { ok: false, status: 404, error: 'Class not found.' };
  if (!canAccessClassRecords(user, classGroup)) return { ok: false, status: 403, error: 'Forbidden.' };

  const students = (await dbStore.getStudents())
    .filter(s => s.schoolId === classGroup.schoolId && s.classGroup === classGroup.className && s.section === classGroup.section)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (students.length === 0) {
    return { ok: false, status: 400, error: 'No students found in this class roster.' };
  }
  if (students.length > MAX_SHEET_STUDENTS) {
    return { ok: false, status: 400, error: `A sheet can hold at most ${MAX_SHEET_STUDENTS} children; this class has ${students.length}.` };
  }

  // A concept is observed when one of its live templates is marked observed or both.
  const observable = new Set(
    (await dbStore.getQuestionTemplates())
      .filter(t => t.assessmentMode === 'observed' || t.assessmentMode === 'both')
      .map(t => t.conceptId)
  );
  let conceptList: string[];
  if (input.requested) {
    const notObserved = input.requested.filter(c => !observable.has(c));
    if (input.strict && notObserved.length > 0) {
      return { ok: false, status: 400, error: `${notObserved.join(', ')} ${notObserved.length === 1 ? 'is' : 'are'} not observed by a teacher, so there is no observation sheet row for ${notObserved.length === 1 ? 'it' : 'them'}.` };
    }
    conceptList = input.requested.filter(c => observable.has(c) && getLevelForConcept(c)).slice(0, MAX_SHEET_CONCEPTS);
  } else {
    conceptList = [...observable].filter(c => getLevelForConcept(c)).slice(0, MAX_SHEET_CONCEPTS);
  }
  const concepts = conceptList
    .map(c => ({ conceptId: c, levelNumber: getLevelForConcept(c)!.levelNumber, title: getLevelForConcept(c)!.levelTitle }))
    .sort((a, b) => a.levelNumber - b.levelNumber);
  if (concepts.length === 0) {
    return { ok: false, status: 404, error: 'No concept is marked as observed, so there is nothing to put on the sheet.' };
  }

  const sheets: BuiltObservationSheets['sheets'] = [];
  for (const layout of input.layouts) {
    const result = await renderObservationSheet({
      sheetId: `OBS_${randomUUID().slice(0, 8)}`,
      layout,
      className: classGroup.className,
      section: classGroup.section,
      cycle: input.cycle,
      students: students.map(s => ({ id: s.id, name: s.name, displayId: s.displayId })),
      concepts,
    });
    sheets.push({ layout, pdfUrl: result.pdfUrl, pageCount: result.pageCount });
  }
  return {
    ok: true,
    sheets,
    studentCount: students.length,
    concepts: concepts.map(c => ({ conceptId: c.conceptId, level: c.levelNumber })),
  };
}

export interface WorksheetSheetRequest {
  classId: string;
  cycle: string;
  layouts: ObservationLayout[];
}

/**
 * Reads the optional `observationSheet` field of a worksheet request (#618). Absent means
 * "no sheet". Both layouts are printed unless the teacher names one or both.
 */
export function parseWorksheetSheetRequest(raw: unknown): WorksheetSheetRequest | { error: string } | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return { error: 'observationSheet must be an object with classId and cycle.' };
  const { classId, cycle, layouts } = raw as Record<string, unknown>;
  if (typeof classId !== 'string' || !classId.trim() || classId.trim().length > 100) {
    return { error: 'observationSheet.classId is required.' };
  }
  if (typeof cycle !== 'string' || !(CYCLE_NAMES as readonly string[]).includes(cycle)) {
    return { error: `observationSheet.cycle must be one of: ${CYCLE_NAMES.join(', ')}` };
  }
  let chosen: ObservationLayout[] = [...OBSERVATION_LAYOUTS];
  if (layouts !== undefined) {
    if (!Array.isArray(layouts) || layouts.length === 0 || !layouts.every(l => (OBSERVATION_LAYOUTS as readonly unknown[]).includes(l))) {
      return { error: `observationSheet.layouts must be a list of: ${OBSERVATION_LAYOUTS.join(', ')}.` };
    }
    chosen = [...new Set(layouts as ObservationLayout[])];
  }
  return { classId: classId.trim(), cycle, layouts: chosen };
}

/**
 * The sheet for a worksheet request. It never throws and never fails the worksheet: a
 * teacher who cannot print the sheet (wrong class, nothing observed) still gets the worksheet
 * and a reason, instead of losing both.
 */
export async function buildSheetsForWorksheet(user: AuthUser, request: WorksheetSheetRequest, conceptIds: unknown[]) {
  try {
    const requested = [...new Set(conceptIds.map(c => String(c).trim()).filter(Boolean))];
    const built = await buildObservationSheets(user, { ...request, requested, strict: false });
    if ('error' in built) return { success: false as const, error: built.error };
    return { success: true as const, sheets: built.sheets, studentCount: built.studentCount, concepts: built.concepts };
  } catch (err: any) {
    console.error('[Observations] sheet with worksheet failed:', err?.message || err);
    return { success: false as const, error: 'Could not create the observation sheet.' };
  }
}
