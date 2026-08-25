// Issue #184: a clean, printable numeric display ID for students, computed at
// creation time — separate from the internal `id` primary key, which stays
// untouched everywhere else in the codebase.
//
// Encodes the same non-sensitive hierarchy already present in the existing
// composite `id` (e.g. `s_HR_AMB_AMB_01_01_C2_01`): state, district, block,
// school, class, and the student's sequence within that class. State/district
// are resolved to their index in STATES_UTS (the single source of truth for
// the geo hierarchy elsewhere in this codebase); block/school/class numbers
// are read directly off the codes already assigned to the School/ClassGroup.
//
// No Aadhaar or PIN-code fragments are used — that approach was explicitly
// considered and rejected for this issue (see #184).
import { STATES_UTS } from './geoData';

function pad(n: number, width: number): string {
  return String(Math.max(0, n)).padStart(width, '0').slice(-width);
}

export function computeStudentDisplayId(params: {
  stateCode: string;
  districtCode: string;
  blockCode: string; // e.g. "AMB_01"
  schoolId: string; // e.g. "HR_AMB_AMB_01_01"
  classGroup: string; // e.g. "Class 2"
  sequenceInClass: number; // 1-based
}): string {
  const state = STATES_UTS.find(s => s.code === params.stateCode);
  const stateIdx = state ? STATES_UTS.indexOf(state) + 1 : 0;
  const districtIdx = state
    ? state.districts.findIndex(d => d.code === params.districtCode) + 1
    : 0;

  const blockMatch = params.blockCode.match(/(\d+)$/);
  const blockNum = blockMatch ? parseInt(blockMatch[1], 10) : 0;

  const schoolMatch = params.schoolId.match(/(\d+)$/);
  const schoolNum = schoolMatch ? parseInt(schoolMatch[1], 10) : 0;

  const classMatch = params.classGroup.match(/(\d+)/);
  const classNum = classMatch ? parseInt(classMatch[1], 10) : 0;

  return [
    pad(stateIdx, 2),
    pad(districtIdx, 1),
    pad(blockNum, 1),
    pad(schoolNum, 2),
    pad(classNum, 1),
    pad(params.sequenceInClass, 3),
  ].join('-');
}
