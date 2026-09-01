import express from 'express';
import path from 'path';
import fs from 'fs';
import { dbStore, UserRole, Student, Question, AnswerSubmission, EvaluationReport, EvaluationReasoning, CYCLE_NAMES } from '../db';
import { answersMatch } from '../answerMatching';
import { getAuthUser, canAccessStudent } from '../auth';
import { generateDiagnosticPaper } from '../paperGenerator';
import { generateQuestionsForLevel } from '../levelGenerator';
import { evaluateAIDiagnostic } from '../gemini';
import { AI_SERVICES_DIR, PYTHON_BIN } from '../config';
import { invalidateFingerprintCache } from './misconceptions';
import { assignStudentToArchetype } from '../studentArchetypeService';
import { resolvePrerequisites, describeConcept, directPrerequisites } from '../competencyPrerequisites';
import { CURRICULUM_MAPPING } from '../config/curriculumMap';
import { computeStudentDisplayId } from '../displayId';

/**
 * The pipeline's output file for a student, tried against both date spellings.
 *
 * `run_pipeline.py` names its output with the machine's LOCAL date; this
 * handler was building the path from `new Date().toISOString()`, which is UTC.
 * East of Greenwich the two disagree for the first hours of every local day —
 * in IST, midnight to 05:30 — and the lookup silently missed. Nothing threw:
 * `score` and `recommendedLevel` kept their initial 0 and 1, so every child
 * assessed in that window was placed at Level 1 with a score of zero and none
 * of the pipeline's analysis was recorded.
 *
 * Returns the first path that exists, or null when the pipeline produced
 * nothing under either name.
 */
function findPipelineFile(dir: string, prefix: string, suffix: string): string | null {
  const now = new Date();
  const utcDate = now.toISOString().split('T')[0];
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
  for (const date of [...new Set([localDate, utcDate])]) {
    const candidate = path.join(dir, `${prefix}${date}${suffix}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Lift the per-error detail out of a `run_pipeline.py` evaluation JSON.
 *
 * The pipeline has always written `root_causes`, `levels_failed`,
 * `prerequisites_to_check` and `performance_by_difficulty`; the diagnostic
 * handler read `topics_to_focus` and dropped the rest on the floor. Everything
 * downstream that asks HOW a child failed — the misconception fingerprint, the
 * pipeline/measurement reconciliation — reads exactly these fields, so a
 * diagnostic-only child arrived there with nothing to read.
 *
 * Nothing here is inferred. When the pipeline's LLM step falls back it emits a
 * single overall verdict rather than one entry per question; in that case each
 * wrong answer is recorded with its OWN topic and level (from the question the
 * child actually sat) and the pipeline's overall `error_type` restated against
 * it. A shape the pipeline did not report is left unclassified rather than
 * guessed at — a fabricated cause is indistinguishable from a measured one
 * once it is downstream.
 */
function readPipelineDetail(
  evalData: any,
  questions: Question[],
  answers: { [questionId: string]: string }
): {
  rootCauses?: EvaluationReport['rootCauses'];
  levelsFailed?: number[];
  prerequisitesToCheck?: string[];
  performanceByDifficulty?: EvaluationReport['performanceByDifficulty'];
} {
  const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
  const rawCauses: any[] = Array.isArray(evalData?.root_causes) ? evalData.root_causes : [];

  // Per-question causes, where the pipeline produced them.
  const keyed = rawCauses.filter(c => c && (c.question_id || c.questionId));
  let rootCauses: EvaluationReport['rootCauses'] = keyed.map(c => {
    const questionId = String(c.question_id ?? c.questionId);
    const question = questions.find(q => q.question_id === questionId);
    return {
      questionId,
      error: String(c.error ?? answers?.[questionId] ?? ''),
      topic: String(c.topic ?? question?.topic ?? 'Unclassified'),
      flnLevel: Number(c.fln_level ?? c.flnLevel ?? question?.source_level ?? 0),
      errorType: String(c.error_type ?? c.errorType ?? 'unclassified'),
      analysis: String(c.analysis ?? '')
    };
  });

  if (rootCauses.length === 0) {
    const overallType = evalData?.error_type ? String(evalData.error_type) : 'unclassified';
    const overallAnalysis = evalData?.root_cause ? String(evalData.root_cause) : '';
    rootCauses = questions
      .filter(q => norm(answers?.[q.question_id]) !== norm(q.answer))
      .map(q => ({
        questionId: q.question_id,
        error: String(answers?.[q.question_id] ?? ''),
        topic: q.topic || 'Unclassified',
        flnLevel: Number(q.source_level ?? 0),
        errorType: overallType,
        analysis: overallAnalysis
      }));
  }

  // Measured from the paper when the pipeline reported no breakdown of its own.
  let performanceByDifficulty: EvaluationReport['performanceByDifficulty'] =
    evalData?.performance_by_difficulty && typeof evalData.performance_by_difficulty === 'object'
      ? evalData.performance_by_difficulty
      : undefined;
  if (!performanceByDifficulty) {
    const tally: NonNullable<EvaluationReport['performanceByDifficulty']> = {};
    for (const q of questions) {
      const difficulty = q.difficulty || 'medium';
      const cell = tally[difficulty] ?? { attempted: 0, correct: 0 };
      cell.attempted++;
      if (norm(answers?.[q.question_id]) === norm(q.answer)) cell.correct++;
      tally[difficulty] = cell;
    }
    if (Object.keys(tally).length > 0) performanceByDifficulty = tally;
  }

  return {
    rootCauses: rootCauses.length > 0 ? rootCauses : undefined,
    levelsFailed: Array.isArray(evalData?.levels_failed)
      ? evalData.levels_failed.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined,
    prerequisitesToCheck: Array.isArray(evalData?.prerequisites_to_check)
      ? evalData.prerequisites_to_check.map((p: any) => String(p))
      : undefined,
    performanceByDifficulty
  };
}

export function registerStudentRoutes(app: express.Express) {
  // Students
  app.get('/api/students', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // The students collection has 86400+ docs in Atlas; without a server-side
    // limit a single query takes multi-seconds and the dashboard hangs. Push the
    // limit/offset into mongo. Default 1000 unless caller opts in to full set.
    const DEFAULT_LIMIT = 1000;
    const requestedLimit = parseInt(String(req.query.limit ?? ''), 10);
    const requestedOffset = parseInt(String(req.query.offset ?? ''), 10) || 0;
    const wantAll = req.query.all === '1' || req.query.all === 'true';
    const limit = wantAll ? 0 : (Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, DEFAULT_LIMIT * 5) : DEFAULT_LIMIT);

    // server-side role scoping
    let schoolScope: string | undefined;
    if (user.role === UserRole.TEACHER || user.role === UserRole.SCHOOL) {
      schoolScope = user.schoolId;
    }

    const opts: { limit?: number; offset?: number; schoolId?: string } = {
      offset: requestedOffset,
    };
    if (limit > 0) opts.limit = limit;
    if (schoolScope) opts.schoolId = schoolScope;

    const students = await dbStore.getStudents(opts);

    // volunteer filter still applied in JS (assignedSchools list, not a single key)
    const filtered = (user.role === UserRole.VOLUNTEER)
      ? students.filter(s => user.assignedSchools?.includes(s.schoolId))
      : students;

    // Mask Aadhar for non-Superadmins (§13.2 R-6)
    const masked = filtered.map(s => {
      if (user.role !== UserRole.SUPERADMIN) {
        return { ...s, aadharMasked: 'XXXX-XXXX-' + String(s.aadharMasked || '').slice(-4) };
      }
      return s;
    });

    // total count (for client-side pagination headers)
    const total = await dbStore.countStudents(schoolScope ? { schoolId: schoolScope } : undefined);
    res.set('X-Total-Count', String(total));
    res.json(masked);
  });

  // Get or generate student's assigned 10-question FLN paper from MongoDB Atlas (Class 2: Levels 22 to 31)
  app.get('/api/students/:id/diagnostic-paper', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();

    // Roles with a direct, day-to-day relationship to the child (and superadmin)
    // see full contact/address PII; aggregate-scope admins and volunteers get it
    // redacted — they don't need a guardian's phone number to view rollups.
    const canSeeGuardianPII = (role: UserRole) =>
      role === UserRole.SUPERADMIN || role === UserRole.SCHOOL || role === UserRole.TEACHER;

    // Mask Aadhar for non-Superadmins (§13.2 R-6); redact guardian contact/address similarly.
    const maskedStudents = students.map(s => {
      const masked = user.role !== UserRole.SUPERADMIN
        ? { ...s, aadharMasked: 'XXXX-XXXX-' + s.aadharMasked.slice(-4) }
        : { ...s };
      if (!canSeeGuardianPII(user.role)) {
        delete masked.guardianContact;
        delete masked.address;
      }
      return masked;
    });

    let scoped: typeof maskedStudents;
    if (user.role === UserRole.SUPERADMIN) {
      scoped = students;
    } else if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      scoped = maskedStudents.filter(s => s.schoolId === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      scoped = maskedStudents.filter(s => user.assignedSchools?.includes(s.schoolId));
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
      // Geo-scope by the admin's own state/district/block, joined via each student's school.
      const schools = await dbStore.getSchools();
      const schoolById = new Map(schools.map(sc => [sc.id, sc]));
      scoped = maskedStudents.filter(s => {
        const school = schoolById.get(s.schoolId);
        if (!school) return false;
        if (user.role === UserRole.ADMIN) return school.stateCode === user.stateCode;
        if (user.role === UserRole.DISTRICT_ADMIN) return school.districtCode === user.districtCode;
        return school.blockCode === user.blockCode; // BLOCK_ADMIN
      });
    } else {
      scoped = maskedStudents;
    }

    // Pagination is opt-in via ?page & ?limit — omitting them returns the full
    // scoped array exactly as before, so existing callers (aggregate/rollup
    // panels that need the whole scope) are unaffected. Callers that just need
    // a page to display (the Student List table) can request one directly
    // instead of always paying for the full national fetch.
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(limitParam || '50', 10) || 50));
      const total = scoped.length;
      const start = (page - 1) * limit;
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(page));
      res.set('X-Pages', String(Math.max(1, Math.ceil(total / limit))));
      return res.json(scoped.slice(start, start + limit));
    }

    res.json(scoped);
  });

  // ─── Shared student-creation helper ────────────────────────────────────────
  // Issue #178: bulk-import must reuse this exact validation/creation logic.
  // Both the single-student POST and the bulk-import POST call this helper so
  // validation is never duplicated and stays in one place.
  const VALID_CLASS_GROUPS = new Set([
    'Preschool 1', 'Preschool 2', 'Balvatika',
    'Class 1', 'Class 2', 'Class 3', 'Class 4',
  ]);

  async function createStudentFromData(
    data: Record<string, any>,
    actingUser: { id: string; email: string; role: UserRole; schoolId?: string },
    existingAadhars: Set<string>,
  ): Promise<{ student: Student } | { error: string }> {
    const { name, classGroup, section, aadharNumber, dob, gender,
      guardianName, guardianRelation, guardianContact, address,
      bloodGroup, disabilityStatus, midDayMealBeneficiary, busRoute, siblingsInSchool } = data;

    // Resolve schoolId — use row value for SUPERADMIN, otherwise auth context
    const schoolId = (actingUser.role === UserRole.SUPERADMIN && data.schoolId)
      ? String(data.schoolId).trim()
      : actingUser.schoolId;

    // Required field check (mirrors issue.txt: name, class, dob, ID card)
    if (!name || !classGroup || !section || !aadharNumber || !schoolId) {
      return { error: 'Missing required fields: name, classGroup, section, aadharNumber' + (!schoolId ? ', schoolId' : '') };
    }

    // classGroup must match enum (issue.txt: "class must match the existing classGroup enum")
    if (!VALID_CLASS_GROUPS.has(String(classGroup).trim())) {
      return { error: `Invalid classGroup "${classGroup}". Must be one of: ${[...VALID_CLASS_GROUPS].join(', ')}` };
    }

    // dob validation + age derivation (issue.txt: "date-of-birth format is valid")
    let age: number;
    if (dob) {
      const dobDate = new Date(String(dob));
      if (isNaN(dobDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dob).trim())) {
        return { error: `Invalid dob "${dob}". Must be YYYY-MM-DD.` };
      }
      // Compute age from dob
      const today = new Date();
      age = today.getFullYear() - dobDate.getFullYear()
        - (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0);
      if (age < 1 || age > 20) return { error: `Computed age (${age}) from dob is out of range.` };
    } else {
      // Fall back to explicit age field
      age = parseInt(String(data.age ?? ''), 10);
      if (!Number.isFinite(age) || age < 1 || age > 20) {
        return { error: 'age must be a number 1–20 when dob is not provided.' };
      }
    }

    // Aadhar uniqueness — SRS §13.2 R-6 (issue.txt: "ID card is unique")
    const rawAadhar = String(aadharNumber).replace(/[^0-9]/g, '');
    if (rawAadhar.length < 4) {
      return { error: 'Invalid identity document — must contain at least 4 digits.' };
    }
    if (existingAadhars.has(rawAadhar)) {
      return { error: 'A student with this Aadhar / ID number is already registered.' };
    }

    // Derive the clean numeric display ID (#184) from the school's geo hierarchy
    // and this student's sequence within their class at this school. Falls back
    // to zeroed segments if the school record can't be found — should not
    // happen given schoolId was already required above, but a missing display
    // ID must never block student creation.
    const trimmedClassGroup = String(classGroup).trim();
    const trimmedSection = String(section).trim();
    let displayId: string | undefined;
    const school = (await dbStore.getSchools()).find(sc => sc.id === schoolId);
    if (school) {
      const classmates = (await dbStore.getStudents({ schoolId })).filter(
        s => s.classGroup === trimmedClassGroup && s.section === trimmedSection
      );
      displayId = computeStudentDisplayId({
        stateCode: school.stateCode,
        districtCode: school.districtCode,
        blockCode: school.blockCode,
        schoolId: school.id,
        classGroup: trimmedClassGroup,
        sequenceInClass: classmates.length + 1,
      });
    }

    const newStudent: Student = {
      id: 'STD_' + Math.floor(10000 + Math.random() * 90000),
      displayId,
      name: String(name).trim(),
      age,
      classGroup: trimmedClassGroup,
      section: trimmedSection,
      schoolId,
      currentLevel: null,
      currentSubLevel: null,
      targetLevel: null,
      aadharMasked: rawAadhar,
      levelHistory: [],
      streak: 0,
    };

    if (actingUser.role === UserRole.TEACHER) {
      newStudent.teacherId = actingUser.id;
    }
    if (address) {
      newStudent.address = String(address).trim();
    }

    await dbStore.addStudent(newStudent);
    // Issue: bulk diagnostic generation ("not authorized for Class N")
    // traced back to no ClassGroup document ever being created for
    // live-registered classes — only the seed data had one. Ensure it
    // exists now so class-tabs, bulk-diagnostic authorization, etc. all
    // work for this student's class going forward.
    await dbStore.ensureClassExists(schoolId, trimmedClassGroup, trimmedSection, actingUser.id);
    // Track in-memory so bulk operations detect intra-batch duplicates too
    existingAadhars.add(rawAadhar);
    return { student: newStudent };
  }

  // Add Student (single)
  app.post('/api/students', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!['SCHOOL', 'TEACHER', 'ADMIN', 'SUPERADMIN', 'VOLUNTEER'].includes(user.role.toUpperCase()) &&
      user.role !== UserRole.SCHOOL && user.role !== UserRole.TEACHER &&
      user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN &&
      user.role !== UserRole.VOLUNTEER) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    // Build aadhars set for uniqueness check
    const rawAadhar = String(req.body.aadharNumber).replace(/[^0-9]/g, '');
    const existingAadhars = await dbStore.getExistingAadhars([rawAadhar]);

    const result = await createStudentFromData(
      { ...req.body, schoolId: req.body.schoolId || user.schoolId },
      user,
      existingAadhars,
    );

    if ('error' in result) return res.status(400).json({ error: result.error });

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: result.student.schoolId,
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Onboarded and verified student: ${result.student.name}`,
    });

    res.json(result.student);
  });

  // ─── POST /api/students/bulk-import ─────────────────────────────────────────
  // Accepts { rows: CsvRow[] }, validates and registers each row immediately.
  // Returns a per-row summary. Allowed roles: SCHOOL, TEACHER, VOLUNTEER, ADMIN+.
  app.post('/api/students/bulk-import', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (
      user.role === UserRole.DISTRICT_ADMIN ||
      user.role === UserRole.BLOCK_ADMIN
    ) {
      return res.status(403).json({ error: 'Forbidden: insufficient role for bulk import.' });
    }

    const rows: Record<string, any>[] = req.body?.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: '`rows` must be a non-empty array.' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 rows per request.' });
    }

    // Pre-load all existing aadhar numbers once; the helper adds new ones as
    // it inserts, so intra-batch duplicates are caught too.
    const aadharsInBatch = rows.map(r => String(r.aadharNumber).replace(/[^0-9]/g, '')).filter(Boolean);
    const existingAadhars = await dbStore.getExistingAadhars(aadharsInBatch);

    const results: {
      row: number; status: 'created' | 'failed'; name?: string; id?: string; reason?: string;
    }[] = [];

    let created = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      const enriched = {
        ...rowData,
        schoolId: rowData.schoolId || user.schoolId,
      };

      const outcome = await createStudentFromData(enriched, user, existingAadhars);

      if ('error' in outcome) {
        failed++;
        results.push({ row: i + 1, status: 'failed', name: rowData.name || '', reason: outcome.error });
      } else {
        created++;
        results.push({ row: i + 1, status: 'created', name: outcome.student.name, id: outcome.student.id });
        await dbStore.addLog({
          id: 'log_' + Date.now() + '_' + i,
          timestamp: new Date().toISOString(),
          schoolId: outcome.student.schoolId,
          schoolName: 'GPS',
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          activityType: 'verify',
          status: 'Success',
          details: `[Bulk Import] Onboarded student: ${outcome.student.name}`,
        });
      }
    }

    return res.json({ created, failed, total: rows.length, results });
  });


  // Update Student (Bypass / manual override for demo ease)
  app.patch('/api/students/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { currentLevel, currentSubLevel, targetLevel, levelHistory } = req.body;
    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    await dbStore.updateStudent(student.id, {
      currentLevel: currentLevel !== null && currentLevel !== undefined ? Number(currentLevel) : null,
      currentSubLevel: currentSubLevel !== undefined ? Number(currentSubLevel) : student.currentSubLevel,
      targetLevel: targetLevel !== null && targetLevel !== undefined ? Number(targetLevel) : null,
      levelHistory: levelHistory || student.levelHistory
    });

    res.json({ success: true });
  });

  // Update Student Profile (guardian/medical/logistics fields) — only the
  // student's own school/teacher, or higher admins, may edit; kept separate
  // from the level-update PATCH above so neither contract has to change.
  app.patch('/api/students/:id/profile', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const {
      gender, dob, guardianName, guardianRelation, guardianContact, address,
      bloodGroup, disabilityStatus, midDayMealBeneficiary, busRoute, siblingsInSchool, teacherNotes,
    } = req.body;

    const updates: Partial<Student> = {};
    if (gender !== undefined) updates.gender = gender;
    if (dob !== undefined) updates.dob = dob;
    if (guardianName !== undefined) updates.guardianName = guardianName;
    if (guardianRelation !== undefined) updates.guardianRelation = guardianRelation;
    if (guardianContact !== undefined) updates.guardianContact = guardianContact;
    if (address !== undefined) updates.address = address;
    if (bloodGroup !== undefined) updates.bloodGroup = bloodGroup;
    if (disabilityStatus !== undefined) updates.disabilityStatus = disabilityStatus;
    if (midDayMealBeneficiary !== undefined) updates.midDayMealBeneficiary = Boolean(midDayMealBeneficiary);
    if (busRoute !== undefined) updates.busRoute = busRoute;
    if (siblingsInSchool !== undefined) updates.siblingsInSchool = siblingsInSchool;
    if (teacherNotes !== undefined) updates.teacherNotes = teacherNotes;

    await dbStore.updateStudent(student.id, updates);

    res.json({ success: true });
  });

  // Run Onboarding AI Diagnostic Test
  app.post('/api/students/:id/diagnostic', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    // Parse class number from classGroup (e.g. "Class 2" -> 2)
    const classMatch = student.classGroup.match(/\d+/);
    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

    let questions: Question[];
    let pdfUrl = '';

    try {
      // Generate the official PDF worksheet paper via Puppeteer
      const result = await generateDiagnosticPaper({
        classNumber,
        students: [{
          name: student.name,
          studentId: student.id,
          qrData: {
            age: student.age, classGroup: student.classGroup, section: student.section,
            schoolId: student.schoolId, currentLevel: student.currentLevel,
            currentSubLevel: student.currentSubLevel, targetLevel: student.targetLevel
          }
        }]
      });
      questions = result.questions;
      pdfUrl = `/output/${result.fileName}`;
    } catch (err: any) {
      console.error("Puppeteer paper generation failed, using level generator mock:", err);
      const startLevel = (classNumber - 1) * 12 + 1;
      questions = [];
      for (let lvl = startLevel; lvl < startLevel + 8; lvl++) {
        const lvlQuestions = generateQuestionsForLevel(Math.min(lvl, 93), 0);
        lvlQuestions.forEach(q => {
          questions.push({
            ...q,
            question_id: `DIAG_${lvl}_${q.question_id}`,
            source_level: Math.min(lvl, 93)
          });
        });
      }
      questions = questions.slice(0, 12);
    }

    res.json({
      student,
      diagnosticPaper: {
        id: 'diag_' + student.id + '_' + Date.now(),
        studentId: student.id,
        studentName: student.name,
        questions,
        pdfUrl
      }
    });
  });

  // Generate multi-student PDF worksheet paper (Puppeteer pipeline)
  app.post('/api/paper/generate', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { class: classNumber, students } = req.body;
      if (classNumber === undefined || classNumber === null) {
        return res.status(400).json({ success: false, error: 'class is required.' });
      }
      if (!Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ success: false, error: 'students must be a non-empty array.' });
      }

      const result = await generateDiagnosticPaper({
        classNumber: Number(classNumber),
        students: students.map((s: any) => ({ ...s, studentId: s.studentId || s.id || s.rollNo }))
      });

      const pdfUrl = `/output/${result.fileName}`;
      res.json({
        success: true,
        pdfUrl,
        totalSets: result.totalSets,
        studentOrder: result.studentOrder
      });
    } catch (err: any) {
      console.error('Failed to generate class paper sets:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Submit and evaluate Diagnostic responses
  // The diagnostic and baseline submits are the same assessment: same paper,
  // same grading, same placement. They differ only in how the answers arrive —
  // typed on the verification screen, or uploaded as a JSON answer map — and in
  // the response shape each screen reads. One handler, so the grading rules
  // cannot drift apart between them.
  const submitDiagnostic = (mode: 'diagnostic' | 'baseline') => async (req: express.Request, res: express.Response) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Both stay mutable: `questions` is resolved server-side below when the
    // caller sends answers alone, and `answers` is re-keyed from positional
    // ids ("Q1".."Qn") to real question ids before grading.
    let { questions, answers } = req.body;
    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    // Parse class number from classGroup (e.g. "Class 2" -> 2)
    const classMatch = student.classGroup.match(/\d+/);
    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

    // Resolve the paper server-side when the caller sends answers alone.
    //
    // The scanner's verification screen has the child's answers but no business
    // holding the answer key — it arrives from the server for display and
    // sending it back would let a client decide what "correct" means. Callers
    // that already pass `questions` (the diagnostic workflow) are unaffected.
    if (!Array.isArray(questions) || questions.length === 0) {
      questions = await dbStore.getStudentAssignedQuestions(student.id, classNumber);
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No diagnostic paper is on file for this student.' });
    }
    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: 'No answers submitted.' });
    }

    // An uploaded answer sheet is keyed by position — {"Q1":"A","Q2":"5"} — the
    // format printed on the upload screen and the one the ICR pipeline emits.
    // The grading below reads answers by `question_id`, so translate before it
    // runs. Keys that already name a question are left alone, which makes this
    // a no-op for the on-screen diagnostic and lets a mixed sheet through.
    const questionIds = new Set(questions.map((q: Question) => q.question_id));
    const positional: Record<string, string> = {};
    let remapped = 0;
    for (const [key, value] of Object.entries(answers as Record<string, string>)) {
      if (questionIds.has(key)) {
        positional[key] = String(value);
        continue;
      }
      const posMatch = /^Q(\d+)$/i.exec(key.trim());
      const q = posMatch ? questions[parseInt(posMatch[1], 10) - 1] : undefined;
      if (q) {
        positional[q.question_id] = String(value);
        remapped++;
      }
    }
    // Fallback: if the submitted answer keys don't match the student's
    // assignedDiagnosticQuestions paper (a known issue when the answer-key
    // endpoint returns IDs from the diagnostic_answer_keys collection using a
    // different ID scheme than the assigned paper), try the diagnostic
    // answer-key record directly. This unblocks the bulk-OCR submit path
    // where the verify UI pulls from one source and the submit checks
    // against another. Same translation rules as above.
    if (Object.keys(positional).length === 0) {
      try {
        const ak = await dbStore.getStudentDiagnosticAnswerKey(student.id);
        if (ak && Array.isArray(ak.questions) && ak.questions.length > 0) {
          const akQuestions = ak.questions as Array<Question & { qid?: string }>;
          const akIds = new Set(akQuestions.map((q) => q.question_id || q.qid || ''));
          for (const [key, value] of Object.entries(answers as Record<string, string>)) {
            if (akIds.has(key)) {
              positional[key] = String(value);
              continue;
            }
            const posMatch = /^Q(\d+)$/i.exec(key.trim());
            const q = posMatch ? akQuestions[parseInt(posMatch[1], 10) - 1] : undefined;
            if (q) {
              positional[q.question_id || q.qid || ''] = String(value);
              remapped++;
            }
          }
          // If the answer-key questions actually match better, prefer them
          // for grading too (so the report uses the right paper).
          if (Object.keys(positional).length > 0) {
            console.log(`[baseline] fell back to diagnostic_answer_keys for ${student.id} (${Object.keys(positional).length} matched)`);
            questions = akQuestions.map((q) => ({
              ...q,
              question_id: q.question_id || q.qid || '',
            })) as Question[];
          }
        }
      } catch (_e) {
        // Non-fatal — we'll fall through to the original 400 below.
      }
    }
    if (Object.keys(positional).length === 0) {
      return res.status(400).json({
        error: `None of the ${Object.keys(answers).length} answer key(s) match this student's paper. Expected question ids like "${questions[0].question_id}" or positions "Q1".."Q${questions.length}".`
      });
    }
    if (remapped > 0) console.log(`[baseline] remapped ${remapped} positional answer key(s) for ${student.id}`);
    answers = positional;

    const dateStr = new Date().toISOString().split('T')[0];

    // Idempotency: if this student's diagnostic was already submitted and
    // evaluated today (e.g. a client retry after a timeout), return that
    // existing report instead of re-running the pipeline and re-appending to
    // level history. A genuinely new diagnostic on a later date still runs
    // normally (legitimate re-assessment, not a duplicate retry).
    const existingReports = await dbStore.getEvaluationReports();
    const existingReport = existingReports.find(r =>
      r.worksheetId === 'diagnostic' && r.studentId === student.id && r.timestamp.startsWith(dateStr)
    );
    if (existingReport) {
      if (mode === 'baseline') {
        return res.json({
          assignedLevel: existingReport.recommendedLevel,
          classNumber,
          recommendedAction: null,
          narrative: existingReport.narrative,
          alreadySubmitted: true
        });
      }
      return res.json({
        student,
        evaluation: { score: existingReport.score, recommendedLevel: existingReport.recommendedLevel, narrative: existingReport.narrative },
        report: existingReport,
        alreadySubmitted: true
      });
    }

    // Connect to Python Evaluation Metrics Pipeline
    const pipelineDir = AI_SERVICES_DIR;
    const responseDir = path.join(pipelineDir, 'student_responses', `class_${classNumber}`, 'phrase_1');
    fs.mkdirSync(responseDir, { recursive: true });

    // Map answers for the Python pipeline. The pipeline's `1_compare_answers.py`
    // looks each answer key up in `ai-services/questions/class_2/phrase_1/
    // class_2_exam_phrase_1.json` (the static question bank). When the paper
    // was generated dynamically by `generateClass2PaperFromAtlas` — because
    // the live `questionBank` collection is empty (verified) — the paper's
    // `question_id`s (e.g. `Q_L22_1`) are NOT in that static bank. So we
    // (a) key the answers by the paper's *actual* `question_id` (not by an
    // index-based Q1..Q10 that would alias the wrong static bank question),
    // and (b) embed the paper's per-question metadata in `studentResponse.questions`
    // so the comparator can fall back to it without a DB lookup.
    const pipelineAnswers: { [qId: string]: { answer: string, confidence: number } } = {};
    const paperQuestions: { [qId: string]: {
      answer: string;
      topic: string;
      subtopic: string;
      difficulty: string;
      class_level: number;
      source_level: number;
      conceptId?: string;
      conceptTitle?: string;
    } } = {};
    questions.forEach((q) => {
      const submitted = (answers[q.question_id] || '').trim();
      pipelineAnswers[q.question_id] = {
        answer: String(submitted),
        confidence: 0.95
      };
      paperQuestions[q.question_id] = {
        answer: String(q.answer || '').trim(),
        topic: q.topic || '',
        subtopic: q.subtopic || '',
        difficulty: q.difficulty || 'medium',
        class_level: classNumber,
        source_level: q.source_level || classNumber,
        conceptId: q.conceptId,
        conceptTitle: CURRICULUM_MAPPING[q.source_level || 0]?.levelTitle,
      };
    });

    const studentResponse = {
      student_id: student.id,
      student_name: student.name,
      enrolled_class: classNumber,
      test_date: dateStr,
      phrase: 'phrase_1',
      exam_id: `C${classNumber}_WORKSHEET_PHRASE_1`,
      // Embedded paper question metadata so the Python comparator can grade
      // against the actual paper questions when the static question bank
      // does not contain them.
      questions: paperQuestions,
      answers: pipelineAnswers
    };

    const responsePath = path.join(responseDir, `${student.id}.json`);
    fs.writeFileSync(responsePath, JSON.stringify(studentResponse, null, 2));

    // Variables assigned by the scoring block below. Declared here (function
    // scope) so the rest of the handler can read them after the local block.
    let score = 0;
    let recommendedLevel = 1;
    let narrative = '';
    let pipelineDetail: {
      rootCauses?: EvaluationReport['rootCauses'];
      levelsFailed?: number[];
      prerequisitesToCheck?: string[];
      performanceByDifficulty?: EvaluationReport['performanceByDifficulty'];
    } = {};

    // Grade the submitted answers server-side. We do this ourselves instead
    // of trusting the Python pipeline / Gemini / evalData.demonstrated_level
    // because:
    //   - the Python pipeline frequently fails (503 retries logged in earlier
    //     sessions) and even when it succeeds, the demonstrated_level string
    //     can be empty or unparseable
    //   - Gemini's deterministic fallback maps `recommendedLevel` to the
    //     lowest source_level of any failed question, which for Class 2 papers
    //     is level 2 regardless of how many questions the student actually
    //     answered — that's the "always level 2" bug the user reported
    //   - the prior hardcoded `(classNumber - 1) * 10 + 1` formula was a
    //     placeholder that produced nonsense for partial scores
    //
    // The placement we return is computed purely from the paper's source_level
    // distribution and the answers the teacher keyed in. The placement has
    // three components:
    //   - score:          number of boxes answered correctly
    //   - recommendedLevel: lowest source_level where the student failed any
    //                       question (Weakest-Level Mapping). All-correct →
    //                       max source_level + 1, capped at 93.
    //   - subLevel:       0 (Mastery) / 1 (Easier) / 2 (Remedial) within the
    //                       recommended level based on how many of that level's
    //                       questions were missed.
    const questionResults = questions.map((q) => {
      const srcLevel = Number(q.source_level);
      return {
        q,
        // answersMatch, not string equality: these answers are OCR'd
        // handwriting, and "07" vs "7" is notation rather than a wrong
        // answer. Getting this wrong does not just lose a mark, it lowers
        // the child's placement. See backend/src/answerMatching.ts.
        isCorrect: answersMatch(answers[q.question_id], q.answer),
        sourceLevel: Number.isFinite(srcLevel) ? srcLevel : NaN,
      };
    });
    score = questionResults.filter((r) => r.isCorrect).length;
    // One-to-one correspondence log: print every question's verdict so the
    // backend trace shows exactly what was matched against what. Format:
    //   [diag] qid=Q_L20_1_1_b1  submitted="2"  expected="2"  ✓  L20  S1.1
    // Lets the teacher + dev correlate the UI table with the grading pass
    // without needing to log every question's full payload.
    console.log(`[diag] ${student.id} (${student.name}, Class ${classNumber}) — grading ${questionResults.length} questions, ${score} correct`);
    for (const r of questionResults) {
      const submitted = String(answers[r.q.question_id] ?? '').trim();
      const mark = r.isCorrect ? '✓' : (submitted ? '✗' : '—');
      const lvl = Number.isFinite(r.sourceLevel) ? `L${r.sourceLevel}` : 'L?';
      const concept = r.q.conceptId ? ` ${r.q.conceptId}` : '';
      console.log(
        `[diag]   ${mark} qid=${r.q.question_id}  submitted=${JSON.stringify(submitted)}  expected=${JSON.stringify(String(r.q.answer ?? ''))}  ${lvl}${concept}`
      );
    }
    const allCorrect = questionResults.every((r) => r.isCorrect);
    const wrongResults = questionResults.filter((r) => !r.isCorrect);
    const assessedLevels: number[] = questionResults
      .map((r) => r.sourceLevel)
      .filter((l): l is number => Number.isFinite(l));
    const failedLevels: number[] = (Array.from(new Set(
      wrongResults
        .map((r) => r.sourceLevel)
        .filter((l): l is number => Number.isFinite(l))
    )) as number[]).sort((a, b) => a - b);

    if (failedLevels.length > 0) {
      // Weakest-Level Mapping: place at the lowest level the child failed.
      recommendedLevel = Math.max(1, failedLevels[0]);
    } else if (wrongResults.length > 0) {
      // The child got questions wrong, but none of those questions carries a
      // usable `source_level`. Branching on `failedLevels` alone would fall
      // through to the mastery case below and PROMOTE a child who failed —
      // `source_level` is typed `number` but arrives from Mongo unchecked,
      // which is why it is guarded at all. Hold at the lowest level the paper
      // actually assessed instead, and say so loudly: this is a data defect
      // in the paper, not a fact about the child.
      const lowestAssessed = assessedLevels.length > 0 ? Math.min(...assessedLevels) : 1;
      recommendedLevel = Math.max(1, lowestAssessed);
      console.warn(
        `[diag] ${student.id}: ${wrongResults.length} wrong answer(s) but none carry a numeric source_level. ` +
        `Holding at Level ${recommendedLevel} rather than promoting. Question ids: ` +
        wrongResults.map((r) => r.q.question_id).join(', ')
      );
    } else {
      // Genuinely all correct: advance one past the hardest level assessed.
      const maxLevel = Math.max(0, ...assessedLevels);
      recommendedLevel = Math.min(93, maxLevel + 1);
    }
    pipelineDetail = readPipelineDetail({}, questions, answers);
    narrative = `Determined locally: student solved ${score}/${questions.length} questions correctly. Placed at Level ${recommendedLevel} using Weakest-Level Mapping.`;

    // For the PASS case, the Python pipeline's deterministic fallback narrative
    // is unreliable — it emits a generic "Deterministic fallback" narrative
    // with fabricated root causes even when there are no wrong answers.
    // Generate a success narrative locally so the report reflects the
    // actual demonstrated mastery.
    if (allCorrect) {
      const masteredTitles = Array.from(new Set(
        questionResults
          .map((r) => describeConcept(r.q.conceptId)?.levelTitle)
          .filter((t): t is string => Boolean(t))
      ));

      narrative = [
        '='.repeat(60),
        '            FLN ASSESSMENT REPORT CARD',
        '='.repeat(60),
        '',
        `Student Name: ${student.name}`,
        `Student ID: ${student.id}`,
        `Enrolled Class: ${classNumber}`,
        `Test Date: ${dateStr}`,
        '',
        ' PLACEMENT',
        '-'.repeat(60),
        `Assigned Level: Level ${recommendedLevel}`,
        'Reason: Mastery demonstrated across all assessed competencies.',
        'Confidence: 95%',
        '',
        ' COMPETENCIES DEMONSTRATED',
        '-'.repeat(60),
        ...masteredTitles.map((t) => `  [OK] ${t}`),
        '',
        ' NEXT STEPS FOR TEACHER',
        '-'.repeat(60),
        'SHORT-TERM (Next 1-2 weeks):',
        '1. Reinforce demonstrated competencies through daily practice.',
        `2. Introduce next-level concepts to extend the student's growth.`,
        '3. Continue routine class participation and worksheet drills.',
        '',
        'MEDIUM-TERM (Next month):',
        `- Target next milestone: Level ${Math.min(93, recommendedLevel + 1)}.`,
        '',
        'The student demonstrated mastery in this attempt. No prerequisite remediation is required.',
        '',
        '='.repeat(60),
      ].join('\n');
    }

    // Determine the subLevel based on weakest-level mapping questions
    let subLevel = 0; // default Mastery
    // Reuses questionResults rather than re-grading: the same comparison
    // implemented twice is the same comparison waiting to drift apart, and
    // the second copy here previously used bare string equality even after
    // the first was fixed.
    const levelQuestions = questionResults.filter(r => r.sourceLevel === recommendedLevel);
    if (levelQuestions.length > 0) {
      const failedCount = levelQuestions.filter(r => !r.isCorrect).length;

      if (failedCount === levelQuestions.length) {
        subLevel = 2; // Remedial (failed all)
      } else if (failedCount > 0) {
        subLevel = 1; // Easier (failed some)
      } else {
        subLevel = 0; // Mastery
      }
    }

    // Per-level breakdown for the diagnostic panel: distinct level numbers
    // bucketed by pass/fail. De-duplicated with Set so multiple questions at
    // the same level collapse to a single "L5 passed" / "L5 failed" entry.
    const passedLevelSet = new Set<number>();
    const failedLevelSet = new Set<number>();
    for (const r of questionResults) {
      const lvl = r.sourceLevel;
      if (!Number.isFinite(lvl)) continue;
      (r.isCorrect ? passedLevelSet : failedLevelSet).add(lvl);
    }
    const passedLevels = Array.from(passedLevelSet).sort((a, b) => a - b);
    const failedLevelsList = Array.from(failedLevelSet).sort((a, b) => a - b);

    // Skill gaps: pull conceptIds from every FAILED level, plus each of those
    // concept's direct prerequisites (so the panel can show "you are also
    // shaky on the foundation skills that feed into these"). De-duped by
    // conceptId so each gap is listed once.
    const skillGapMap = new Map<string, { conceptId: string; level: number; levelTitle: string; strand: string }>();
    for (const lvl of failedLevelsList) {
      const cfg = CURRICULUM_MAPPING[lvl];
      if (!cfg) continue;
      const desc = describeConcept(cfg.conceptId);
      if (desc && !skillGapMap.has(desc.conceptId)) {
        skillGapMap.set(desc.conceptId, desc);
      }
    }
    // Direct prereqs of every failed concept — these are the foundation
    // skills the student needs to remediate before re-attempting the failed
    // levels. Use directPrerequisites() for the immediate one-hop edges
    // (resolvePrerequisites() returns the full transitive closure, which
    // would surface too many concepts and bury the real gaps).
    for (const lvl of failedLevelsList) {
      const cfg = CURRICULUM_MAPPING[lvl];
      if (!cfg) continue;
      for (const prereqId of directPrerequisites(cfg.conceptId)) {
        const desc = describeConcept(prereqId);
        if (desc && !skillGapMap.has(desc.conceptId)) {
          skillGapMap.set(desc.conceptId, desc);
        }
      }
    }
    const skillGaps = Array.from(skillGapMap.values()).sort((a, b) => a.level - b.level);

    // Update Student placing levels
    const levelHistory = [...student.levelHistory, {
      level: recommendedLevel,
      subLevel,
      date: new Date().toISOString().split('T')[0],
      reason: CYCLE_NAMES[0] // 'Baseline'
    }];

    await dbStore.updateStudent(student.id, {
      currentLevel: recommendedLevel,
      currentSubLevel: subLevel,
      targetLevel: Math.min(93, recommendedLevel + 1),
      levelHistory
    });

    // Create a special Evaluation Report with dynamic mock concept mastery
    const conceptMastery: { [topic: string]: "Strong" | "Needs Practice" | "Satisfactory" } = {
      'Number Sense': recommendedLevel >= 15 ? 'Strong' : 'Needs Practice',
      'Shapes': recommendedLevel >= 25 ? 'Strong' : 'Needs Practice',
      'Fractions': recommendedLevel >= 35 ? 'Strong' : 'Needs Practice',
      'Operations': recommendedLevel >= 12 ? 'Strong' : 'Needs Practice'
    };

    try {
      const evalReportPath = findPipelineFile(
        path.join(pipelineDir, 'evaluation_reports', `class_${classNumber}`, 'phrase_1', 'evaluation'),
        `${student.id}_evaluation_`,
        '.json'
      );
      if (evalReportPath) {
        const evalData = JSON.parse(fs.readFileSync(evalReportPath, 'utf-8'));
        if (evalData.topics_to_focus && Array.isArray(evalData.topics_to_focus)) {
          evalData.topics_to_focus.forEach((t: string) => {
            conceptMastery[t] = 'Needs Practice';
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse dynamic concept mastery:', e);
    }

    // Persist what the child actually wrote, alongside the verdict.
    //
    // The diagnostic is the assessment that sets a child's starting level, and
    // until now it was the one assessment whose evidence was discarded: only an
    // EvaluationReport was written, so a placement could never be traced back to
    // the answers that produced it. The paper travels with the submission
    // because a diagnostic is generated per child and is not stored as a
    // Worksheet — see the `questions` field on AnswerSubmission.
    const submission: AnswerSubmission = {
      id: 'sub_diag_' + student.id + '_' + Date.now(),
      worksheetId: 'diagnostic',
      studentId: student.id,
      studentName: student.name,
      schoolId: student.schoolId,
      classId: student.classGroup,
      submittedAt: new Date().toISOString(),
      isDelayed: false,
      answers,
      questions
    };
    await dbStore.addAnswerSubmission(submission);

    // For the PASS case (10/10), the Python pipeline's deterministic fallback
    // narrative is unreliable — it emits a generic "Deterministic fallback
    // based on wrong answers" narrative with fabricated root causes even
    // when there are no wrong answers. Generate a success narrative locally
    // so the report reflects the actual demonstrated mastery.
    if (allCorrect) {
      const masteredTitles = Array.from(new Set(
        questionResults
          .map((r) => describeConcept(r.q.conceptId)?.levelTitle)
          .filter((t): t is string => Boolean(t))
      ));

      narrative = [
        '='.repeat(60),
        '            FLN ASSESSMENT REPORT CARD',
        '='.repeat(60),
        '',
        `Student Name: ${student.name}`,
        `Student ID: ${student.id}`,
        `Enrolled Class: ${classNumber}`,
        `Test Date: ${dateStr}`,
        '',
        ' PLACEMENT',
        '-'.repeat(60),
        `Assigned Level: Level ${recommendedLevel}`,
        'Reason: Mastery demonstrated across all assessed competencies.',
        'Confidence: 95%',
        '',
        ' COMPETENCIES DEMONSTRATED',
        '-'.repeat(60),
        ...masteredTitles.map((t) => `  [OK] ${t}`),
        '',
        ' NEXT STEPS FOR TEACHER',
        '-'.repeat(60),
        'SHORT-TERM (Next 1-2 weeks):',
        '1. Reinforce demonstrated competencies through daily practice.',
        `2. Introduce next-level concepts to extend the student's growth.`,
        '3. Continue routine class participation and worksheet drills.',
        '',
        'MEDIUM-TERM (Next month):',
        `- Target next milestone: Level ${Math.min(93, recommendedLevel + 1)}.`,
        '',
        'The student demonstrated mastery in this attempt. No prerequisite remediation is required.',
        '',
        '='.repeat(60),
      ].join('\n');
    }

    // Aggregate outcomes per concept, in first-seen order so the result is
    // deterministic for a given paper.
    const conceptOutcomes = new Map<string, { correct: number; total: number }>();
    for (const r of questionResults) {
      const conceptId = r.q.conceptId;
      if (!conceptId) continue;
      const o = conceptOutcomes.get(conceptId) ?? { correct: 0, total: 0 };
      o.total += 1;
      if (r.isCorrect) o.correct += 1;
      conceptOutcomes.set(conceptId, o);
    }

    // A concept counts as failed only when the student got none of its
    // questions right. Per-question correctness is the only source of truth
    // here — deliberately NOT the heuristic conceptMastery above, which is
    // derived from recommendedLevel thresholds and can flag a concept as weak
    // even when every question was answered correctly.
    const failedConceptIds: string[] = [];
    for (const [conceptId, { correct }] of conceptOutcomes) {
      if (correct === 0) failedConceptIds.push(conceptId);
    }

    // Override conceptMastery for the PASS case. The level-threshold heuristic
    // above would otherwise mark every strand as "Needs Practice" because the
    // student is placed at Level 2 — which directly contradicts the
    // demonstrated mastery.
    if (allCorrect) {
      for (const r of questionResults) {
        const cfg = CURRICULUM_MAPPING[r.q.source_level || 0];
        if (cfg?.strand) {
          conceptMastery[cfg.strand] = 'Strong';
        }
      }
    }

    // Prerequisite Learning Path.
    //
    // Identity comes from ONE authoritative field: Question.conceptId — the
    // immutable S1.1-S7.18 tag of the 93-level framework that the concept
    // question generator already stamps on every question it produces, and the
    // key CURRICULUM_MAPPING is built around.
    //
    //   question result (correct / incorrect, from the submitted answers)
    //     -> q.conceptId          (skip the question when absent)
    //     -> CONCEPT_PREREQUISITES (Research/fln_level_networks.md, prereq edges only)
    //     -> prerequisiteLearningPath
    //
    // There is no level-number arithmetic, no topic/subtopic string matching and
    // no translation table. A question whose conceptId is missing, or a concept
    // with no prerequisite edge, contributes nothing — the path is omitted
    // rather than guessed at.
    let prerequisiteLearningPath: EvaluationReasoning['prerequisiteLearningPath'];
    if (failedConceptIds.length > 0) {
      // Walk each failed concept's transitive prerequisites. `mergedPrereqs`
      // keeps first-seen order (deepest foundation first); `prereqCount` records
      // how many distinct failed concepts each prerequisite blocks.
      const mergedPrereqs: string[] = [];
      const prereqCount = new Map<string, number>();
      for (const conceptId of failedConceptIds) {
        const chain = resolvePrerequisites(conceptId);
        for (const p of chain) {
          if (!mergedPrereqs.includes(p)) mergedPrereqs.push(p);
          prereqCount.set(p, (prereqCount.get(p) ?? 0) + 1);
        }
      }

      if (mergedPrereqs.length > 0) {
        // Render ids as curriculum titles via CURRICULUM_MAPPING; an id the
        // curriculum does not know is dropped rather than shown raw.
        const titleOf = (conceptId: string): string | undefined =>
          describeConcept(conceptId)?.levelTitle;
        const titles = (ids: string[]): string[] =>
          ids.map(titleOf).filter((t): t is string => Boolean(t));

        // A prerequisite blocking two or more failed concepts is a shared
        // foundation; the rest are supporting skills.
        const highPriorityFoundations = titles(
          mergedPrereqs.filter((p) => (prereqCount.get(p) ?? 0) >= 2)
        );
        const supportingSkills = titles(
          mergedPrereqs.filter((p) => (prereqCount.get(p) ?? 0) < 2)
        );
        const affectedCompetencies = titles(failedConceptIds);

        prerequisiteLearningPath = {
          highPriorityFoundations,
          supportingSkills,
          affectedCompetencies,
          remediationSequence: [
            ...highPriorityFoundations,
            ...supportingSkills,
            ...affectedCompetencies,
          ],
        };
      }
    }

    // Assemble the full EvaluationReasoning payload. Two branches:
    //
    //   FAIL: existing behavior — emitted when prerequisiteLearningPath exists
    //   PASS: emitted when allCorrect (no failed concepts) — communicates
    //         mastery, progression toward the next milestone, no remediation.
    //
    // Every field is filled from a value this handler has already computed —
    // the narrative string, the conceptMastery object, the
    // recommendedLevel/subLevel placement, and the existing 93-level
    // CURRICULUM_MAPPING. Nothing is inferred or invented: where this handler
    // holds no real data (blockers, recommendations) the arrays are left
    // empty and the UI hides those sections.
    let reasoning: EvaluationReasoning | undefined;
    if (prerequisiteLearningPath) {
      // FAIL branch — derive the demonstrated level from the actual failed
      // concepts' source_levels (via CURRICULUM_MAPPING), NOT from
      // recommendedLevel. recommendedLevel is the *placement* (administrative,
      // set by the Python pipeline); the failed concepts live at the level
      // the student is actually working on. If multiple concepts failed, use
      // the minimum level (the most foundational gap). When no failed concept
      // could be resolved to a level, fall back to recommendedLevel.
      let demonstratedLevel = recommendedLevel;
      let nextDemonstratedLevel: number | null = recommendedLevel + 1;
      if (failedConceptIds.length > 0) {
        const failedFlnLevels: number[] = [];
        for (const cid of failedConceptIds) {
          const cfg = Object.values(CURRICULUM_MAPPING).find((c) => c.conceptId === cid);
          if (cfg) failedFlnLevels.push(cfg.levelNumber);
        }
        if (failedFlnLevels.length > 0) {
          demonstratedLevel = Math.min(...failedFlnLevels);
          nextDemonstratedLevel = Math.min(93, demonstratedLevel + 1);
        }
      }
      const currentCfg = CURRICULUM_MAPPING[demonstratedLevel];
      const nextCfg = nextDemonstratedLevel != null ? CURRICULUM_MAPPING[nextDemonstratedLevel] : undefined;
      reasoning = {
        explanation: {
          // Restatement of the already-computed score and placement; it
          // asserts nothing the report does not already say.
          headline: `Scored ${score}/${questions.length}. Placed at Level ${recommendedLevel}.${subLevel}.`,
          // The pipeline (or Gemini fallback) narrative, reused verbatim.
          narrative,
        },
        conceptMastery,
        learningProgression: {
          currentLevel: demonstratedLevel,
          currentLevelName: currentCfg?.levelTitle ?? '',
          currentStrand: currentCfg?.strand ?? '',
          nextMilestone: nextCfg
            ? { level: nextCfg.levelNumber, name: nextCfg.levelTitle, strand: nextCfg.strand }
            : null,
          // No blocker or recommendation data is produced anywhere in this
          // handler. Empty is the honest value; the UI renders neither.
          blockers: [],
          recommendations: [],
        },
        prerequisiteLearningPath,
      };
    } else if (allCorrect) {
      // PASS branch — student demonstrated mastery of all assessed
      // competencies. Communicate progression toward the next milestone;
      // no remediation needed.
      const currentCfg = CURRICULUM_MAPPING[recommendedLevel];
      const nextCfg = CURRICULUM_MAPPING[recommendedLevel + 1];
      reasoning = {
        explanation: {
          headline: `Scored ${score}/${questions.length}. Mastery demonstrated.`,
          // The locally-built success narrative (overrode Python's fallback
          // narrative above), or a generic PASS summary if Python somehow
          // produced an empty string.
          narrative: narrative || `All ${questions.length} assessed competencies demonstrated.`,
        },
        conceptMastery,
        learningProgression: {
          currentLevel: recommendedLevel,
          currentLevelName: currentCfg?.levelTitle ?? '',
          currentStrand: currentCfg?.strand ?? '',
          nextMilestone: nextCfg
            ? { level: nextCfg.levelNumber, name: nextCfg.levelTitle, strand: nextCfg.strand }
            : null,
          // Empty arrays — honest absence of remediation data; the UI hides
          // sections that would render only with blockers / recommendations.
          blockers: [],
          recommendations: [],
        },
        // prerequisiteLearningPath is OMITTED — there are no failed
        // competencies, so no remediation path. The frontend's
        // `{r.prerequisiteLearningPath && ...}` guard correctly hides the
        // Prerequisite Learning Path section when undefined.
      };
    }

    const report: EvaluationReport = {
      id: 'rep_diag_' + Date.now(),
      studentId: student.id,
      worksheetId: 'diagnostic',
      score,
      totalQuestions: questions.length,
      conceptMastery,
      narrative,
      recommendedLevel,
      recommendedSubLevel: subLevel,
      timestamp: new Date().toISOString(),
      ...pipelineDetail,
      // Per-level pass/fail breakdown — the diagnostic does not assign a
      // placement level (intentional, per the new analytics-first model).
      // The UI uses these to show which levels were demonstrated vs which
      // need remediation, derived from the actual submitted answers.
      passedLevels,
      failedLevels,
      skillGaps,
      ...(reasoning ? { reasoning } : {}),
    };

    await dbStore.addEvaluationReport(report);
    invalidateFingerprintCache();

    try {
      await assignStudentToArchetype(student.id);
    } catch (error) {
      console.error('[archetype] Failed to assign student to misconception archetype:', error);
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: student.schoolId,
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'scan',
      status: 'Success',
      details: `Submitted and scored diagnostic for ${student.name}. Placed at Level ${recommendedLevel}`
    });

    if (mode === 'baseline') {
      // The upload screen places a child and reports the placement; it has no
      // roster row to refresh and renders the narrative on its own.
      return res.json({
        assignedLevel: recommendedLevel,
        classNumber,
        recommendedAction: report.rootCauses && report.rootCauses.length > 0
          ? `Focus on ${report.rootCauses.length} identified error pattern(s).`
          : null,
        narrative
      });
    }

    res.json({ student, evaluation: { score, recommendedLevel, narrative }, report });
  };

  app.post('/api/students/:id/diagnostic/submit', submitDiagnostic('diagnostic'));
  app.post('/api/students/:id/baseline/submit', submitDiagnostic('baseline'));
}
