import httpStatus from 'http-status';
import { StudentRepository } from '../repositories/student.repository';
import { ClassRepository } from '../repositories/class.repository';
import { SchoolRepository } from '../repositories/school.repository';
import { IStudent, IStudentDocument } from '../interfaces/student.interface';
import { AppError } from '../middlewares/errorHandler';

/**
 * Profile response shape returned by `getStudentProfile`.
 *
 * Surface area is intentionally explicit (not a re-export of `IStudent`)
 * so the profile endpoint stays stable even if the underlying Student
 * shape grows new internal fields. `gender` and `enrollmentDate` are
 * declared optional; the service is the single source of truth for
 * deciding whether to populate them (currently neither field exists in
 * the seeded `students` collection, so both end up `null` and the
 * frontend renders "Not Available" per requirement #6).
 *
 * `schoolName` is `null` when the lookup cannot resolve the school
 * (deleted, missing seed, etc.). The frontend renders this as
 * "Not Available" as well.
 */
export interface IStudentProfile {
  id: string;
  name: string;
  age: number;
  gender?: string | null;
  classGroup: string;
  section: string;
  schoolId: string;
  schoolName?: string | null;
  currentLevel: number;
  currentSubLevel?: number | null;
  enrollmentDate?: string | null;
  // Phase 3: Editable personal / contact fields. Surfaced through
  // GET /api/students/:id so the Teacher Dashboard "View Profile"
  // modal reflects whatever the teacher has edited via PATCH. None of
  // these existed in the seeded docs at the time this interface was
  // extended, so all of them are `?: string | null` (or `boolean | null`
  // for midDayMeal) and the display layer falls back to "Not Available".
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  disabilityStatus?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  contactNumber?: string | null;
  residentialAddress?: string | null;
  midDayMeal?: boolean | null;
  busRoute?: string | null;
}

/**
 * Service for the Student module.
 *
 * Mirrors `ClassService`'s minimal shape (constructor-injected repository,
 * thin pass-through methods) but adds the registration flow from legacy
 * `index.ts` POST /api/students (line 420-472):
 *
 *   - Required-field validation (controller-layer, mirrored from legacy)
 *   - Aadhar formatting (`rawAadhar = aadharNumber.replace(/[^0-9]/g, '')`)
 *   - Aadhar-length validation (>=4 digits)
 *   - Uniqueness check via repository
 *   - ID generation: `'STD_' + Math.floor(10000 + Math.random() * 90000)`
 *     (legacy `index.ts` line 444 — inlined here to match the legacy
 *     pattern, not a new shared helper)
 *   - Default level state: currentLevel=1, currentSubLevel=0,
 *     targetLevel=2, levelHistory=[], streak=0
 *   - teacherId is set from the JWT claim when the registering user is a
 *     teacher; left undefined for school admin / superadmin (legacy
 *     line 446: `teacherId: user.role === UserRole.TEACHER ? user.id : undefined`)
 */
export class StudentService {
  private repository: StudentRepository;
  private classRepository: ClassRepository;
  private schoolRepository: SchoolRepository;

  constructor() {
    this.repository = new StudentRepository();
    // ClassRepository is injected only for a future validation that the
    // (classGroup, section) pair is real in the `classes` collection. For
    // now we keep it in scope so Phase 2 can validate without widening the
    // constructor signature again.
    this.classRepository = new ClassRepository();
    // SchoolRepository handles the school-name enrichment for the profile
    // endpoint (read-only look-up by business id). No mutation path here.
    this.schoolRepository = new SchoolRepository();
  }

  /**
   * List students, optionally filtered by classGroup and/or section. The
   * optional `schoolId` is used to scope to the calling teacher's school
   * when the controller pulls it from `req.user.schoolId`.
   */
  async listStudents(filters: {
    classGroup?: string;
    section?: string;
    schoolId?: string;
  }): Promise<IStudentDocument[]> {
    const filter: Record<string, unknown> = {};
    if (filters.classGroup) filter.classGroup = filters.classGroup;
    if (filters.section) filter.section = filters.section;
    if (filters.schoolId) filter.schoolId = filters.schoolId;
    return this.repository.findAll(filter);
  }

  /**
   * Register a new student.
   *
   * `payload` is the validated request body (already coerced: `age` as
   * number, `aadharNumber` as the raw user-entered string). `actingUser`
   * carries the verified JWT identity so the service can stamp `teacherId`
   * when the registering user is a teacher — same behaviour as legacy
   * `index.ts` line 446.
   */
  async registerStudent(
    payload: {
      name: string;
      age: number;
      classGroup: string;
      section: string;
      schoolId: string;
      aadharNumber: string;
    },
    actingUser: { role: string; teacherId?: string }
  ): Promise<IStudentDocument> {
    const { name, age, classGroup, section, schoolId, aadharNumber } = payload;

    // Required-fields check. Legacy returns 400 with a flat error string;
    // we surface the same message via AppError so the global errorHandler
    // produces the matching JSON shape.
    if (!name || !age || !classGroup || !section || !schoolId || !aadharNumber) {
      throw new AppError('Missing required student details.', httpStatus.BAD_REQUEST);
    }

    // Aadhar formatting & length check (legacy `index.ts` lines 431-435).
    const rawAadhar = aadharNumber.replace(/[^0-9]/g, '');
    if (rawAadhar.length < 4) {
      throw new AppError('Invalid identity document.', httpStatus.BAD_REQUEST);
    }

    // Uniqueness check (legacy `index.ts` lines 437-441).
    const isDuplicate = await this.repository.existsByAadhar(rawAadhar);
    if (isDuplicate) {
      throw new AppError(
        'A student with this Aadhar / ID number is already registered.',
        httpStatus.BAD_REQUEST
      );
    }

    // ID generation. Legacy `index.ts` line 444: `'STD_' + Math.floor(10000
    // + Math.random() * 90000)`. We inline the same expression for parity.
    const generatedId = 'STD_' + Math.floor(10000 + Math.random() * 90000);

    // Build the document, applying the legacy defaults and the teacherId
    // stamping rule from legacy `index.ts` line 446.
    const newStudent: IStudent = {
      id: generatedId,
      name,
      age,
      classGroup,
      section,
      schoolId,
      teacherId: actingUser.role === 'teacher' ? actingUser.teacherId : undefined,
      currentLevel: 1, // Start at level 1 before diagnostic (legacy line 447)
      currentSubLevel: 0,
      targetLevel: 2,
      // Store raw Aadhar in DB; Superadmin sees it, others see the masked
      // form at the controller response edge (legacy line 448).
      aadharMasked: rawAadhar,
      levelHistory: [],
      streak: 0,
    };

    return this.repository.create(newStudent);
  }

  /**
   * Fetch a single student profile enriched with the school's human-
   * readable name. Read-only path (no mutation, no create). Implements
   * the `GET /api/students/:id` endpoint surface.
   *
   * Auth & scoping:
   *  - `callingUser.schoolId` is enforced on the student. A teacher can
   *    only see profiles for students at their own school. If the
   *    student's `schoolId` does not match the caller's, a 403 is
   *    returned (consistent with the `getAll` school-scope filter).
   *  - `superadmin` is exempted from the school check so they can
   *    inspect profiles across all schools (matches the role bypass in
   *    `auth.ts`).
   *
   * Missing fields:
   *  - The seeded `students` collection does not include `gender` or
   *    `enrollmentDate`. Both are returned as `null` so the frontend
   *    can render "Not Available" per requirement #6.
   *  - `schoolName` is `null` when the school lookup does not resolve
   *    (e.g. orphaned `schoolId`). Same fallback contract.
   *
   * Throws `AppError(404)` when the student does not exist.
   */
  async getStudentProfile(
    studentId: string,
    callingUser: { role?: string; schoolId?: string }
  ): Promise<IStudentProfile> {
    if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
      throw new AppError('Student id is required.', httpStatus.BAD_REQUEST);
    }

    const student = await this.repository.findById(studentId.trim());
    if (!student) {
      throw new AppError('Student not found.', httpStatus.NOT_FOUND);
    }

    // School-scope enforcement. Skip for superadmin (role-bypass parity
    // with the rest of the API).
    const role = (callingUser.role || '').toLowerCase();
    if (role !== 'superadmin') {
      if (callingUser.schoolId && student.schoolId !== callingUser.schoolId) {
        throw new AppError(
          'You are not authorized to view this student.',
          httpStatus.FORBIDDEN
        );
      }
    }

    // School-name enrichment. Null on lookup failure so the frontend can
    // render "Not Available" gracefully.
    const school = await this.schoolRepository.findByBusinessId(student.schoolId);

    return {
      id: student.id,
      name: student.name,
      age: student.age,
      // Phase 3: `gender` is editable via PATCH /api/students/:id, so
      // we now read it straight off the stored document. Seeded docs
      // (and any future doc without a `gender` field) fall back to
      // `null` so the display layer can render "Not Available".
      gender: student.gender ?? null,
      classGroup: student.classGroup,
      section: student.section,
      schoolId: student.schoolId,
      schoolName: school?.name ?? null,
      currentLevel: student.currentLevel,
      currentSubLevel: student.currentSubLevel ?? null,
      // `enrollmentDate` is not yet exposed via PATCH, so seeded docs
      // (and any doc without the field) continue to surface as `null`.
      // Once that field becomes editable, this line should follow the
      // `student.fieldName ?? null` pattern used for the Phase 3
      // personal / contact fields below.
      enrollmentDate: null,
      // Phase 3: Editable personal / contact fields. Any field that is
      // absent on the stored document comes back as `null` so the
      // Teacher Dashboard modal can show "Not Available" exactly the
      // same way it does for `gender` and `enrollmentDate`. Once the
      // teacher saves via PATCH, the field round-trips through this
      // endpoint on the next View Profile click.
      dateOfBirth: student.dateOfBirth ?? null,
      bloodGroup: student.bloodGroup ?? null,
      disabilityStatus: student.disabilityStatus ?? null,
      guardianName: student.guardianName ?? null,
      guardianRelation: student.guardianRelation ?? null,
      contactNumber: student.contactNumber ?? null,
      residentialAddress: student.residentialAddress ?? null,
      midDayMeal: student.midDayMeal ?? null,
      busRoute: student.busRoute ?? null,
    };
  }

  /**
   * Patch the editable personal fields of a single student.
   *
   * Wire shape (caller-controlled, must already be the diff-only payload):
   *   {
   *     name?, age?, gender?, dateOfBirth?, bloodGroup?, disabilityStatus?,
   *     guardianName?, guardianRelation?, contactNumber?, residentialAddress?,
   *     midDayMeal?, busRoute?,
   *   }
   *
   * Out-of-bounds fields are silently dropped here; the controller is
   * responsible for whitelisting what the caller is allowed to change
   * before forwarding to this method. Read-only fields
   * (`id`, `schoolId`, `classGroup`, `section`, `currentLevel`,
   * `targetLevel`, `streak`, `levelHistory`, `aadharMasked`, etc.) are
   * never accepted by this method even if the caller puts them in the
   * patch.
   *
   * Auth & scoping:
   *  - superadmin: bypasses school-scope so they can patch any student.
   *  - any other role: must match `actingUser.schoolId` against the
   *    student's `schoolId`; otherwise 403.
   *
   * Status codes (via `AppError`):
   *  - 400 when the patch is empty or no editable fields are present.
   *  - 403 on cross-school patch attempts by non-superadmin callers.
   *  - 404 when no student matches `studentId`.
   *
   * Returns the freshly-updated student (plain object, lean) so the
   * controller can pipe it straight to the wire. Role-based Aadhar
   * masking (superadmin sees raw, others see `XXXX-XXXX-1234`) is
   * applied at the controller layer, not here.
   */
  async updateStudent(
    studentId: string,
    patch: Record<string, unknown>,
    actingUser: { role?: string; schoolId?: string }
  ): Promise<IStudent> {
    if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
      throw new AppError('Student id is required.', httpStatus.BAD_REQUEST);
    }

    // Whitelist of editable fields. Anything else in the patch is
    // silently dropped — read-only fields (id, schoolId, classGroup,
    // section, currentLevel, targetLevel, streak, levelHistory,
    // aadharMasked, teacherId) cannot be modified from this endpoint.
    const EDITABLE: readonly string[] = [
      'name',
      'age',
      'gender',
      'dateOfBirth',
      'bloodGroup',
      'disabilityStatus',
      'guardianName',
      'guardianRelation',
      'contactNumber',
      'residentialAddress',
      'midDayMeal',
      'busRoute',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in patch) sanitized[key] = patch[key];
    }

    if (Object.keys(sanitized).length === 0) {
      throw new AppError(
        'No editable fields provided.',
        httpStatus.BAD_REQUEST
      );
    }

    // Light validation of well-known constraints. Failures here produce
    // 400s; the controller does not add its own validation layer.
    if ('name' in sanitized) {
      const name = sanitized.name;
      if (typeof name !== 'string' || name.trim() === '') {
        throw new AppError('Name cannot be empty.', httpStatus.BAD_REQUEST);
      }
      sanitized.name = name.trim();
    }
    if ('age' in sanitized) {
      const age = sanitized.age;
      const ageNum = typeof age === 'number' ? age : Number(age);
      if (!Number.isFinite(ageNum) || ageNum < 3 || ageNum > 25) {
        throw new AppError('Age must be between 3 and 25.', httpStatus.BAD_REQUEST);
      }
      sanitized.age = ageNum;
    }
    if ('contactNumber' in sanitized) {
      const contact = sanitized.contactNumber;
      if (contact != null && contact !== '') {
        const digits = String(contact).replace(/[^0-9]/g, '');
        if (digits.length < 7 || digits.length > 15) {
          throw new AppError(
            'Contact number must contain between 7 and 15 digits.',
            httpStatus.BAD_REQUEST
          );
        }
        // Preserve the user-entered format (e.g. "+91-9876543210") in the
        // DB so the frontend can display it the way the teacher typed it.
        // Only the digit count is validated; sanitization is left to the
        // view layer.
        sanitized.contactNumber = String(contact).trim();
      }
    }
    if ('dateOfBirth' in sanitized) {
      const dob = sanitized.dateOfBirth;
      if (dob != null && dob !== '') {
        const d = new Date(dob as string);
        if (isNaN(d.getTime())) {
          throw new AppError('Date of birth is not a valid date.', httpStatus.BAD_REQUEST);
        }
      }
    }

    // Scope check. Read the student first so we know its school before
    // we attempt the update — same auth pattern as `getStudentProfile`.
    const existing = await this.repository.findById(studentId.trim());
    if (!existing) {
      throw new AppError('Student not found.', httpStatus.NOT_FOUND);
    }

    const role = (actingUser.role || '').toLowerCase();
    if (role !== 'superadmin') {
      if (actingUser.schoolId && existing.schoolId !== actingUser.schoolId) {
        throw new AppError(
          'You are not authorized to edit this student.',
          httpStatus.FORBIDDEN
        );
      }
    }

    const updated = await this.repository.updateById(studentId.trim(), sanitized);
    if (!updated) {
      // Defensive: the doc disappeared between findById and updateById.
      throw new AppError('Student not found.', httpStatus.NOT_FOUND);
    }

    return updated;
  }
}