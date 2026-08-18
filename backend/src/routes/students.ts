import express from 'express';
import path from 'path';
import fs from 'fs';
import { dbStore, UserRole, Student, Question, EvaluationReport, CYCLE_NAMES } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { generateDiagnosticPaper } from '../paperGenerator';
import { generateQuestionsForLevel } from '../levelGenerator';
import { evaluateAIDiagnostic } from '../gemini';
import { AI_SERVICES_DIR, PYTHON_BIN } from '../config';

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

  // Add Student
  app.post('/api/students', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, age, classGroup, section, schoolId, aadharNumber,
      gender, dob, guardianName, guardianRelation, guardianContact, address,
      bloodGroup, disabilityStatus, midDayMealBeneficiary, busRoute, siblingsInSchool,
    } = req.body;
    if (!name || !age || !classGroup || !section || !schoolId || !aadharNumber) {
      return res.status(400).json({ error: 'Missing required student details.' });
    }

    // Enforce Aadhar formatting & masking (§13.2 R-6)
    const rawAadhar = aadharNumber.replace(/[^0-9]/g, '');
    if (rawAadhar.length < 4) {
      return res.status(400).json({ error: 'Invalid identity document.' });
    }

    // Enforce uniqueness check on raw Aadhar number
    const studentsListForDuplicateCheck = await dbStore.getStudents();
    const isDuplicate = studentsListForDuplicateCheck.some(s => s.aadharMasked === rawAadhar);
    if (isDuplicate) {
      return res.status(400).json({ error: 'A student with this Aadhar / ID number is already registered.' });
    }

    const newStudent: Student = {
      id: 'STD_' + Math.floor(10000 + Math.random() * 90000),
      name,
      age: parseInt(age),
      classGroup,
      section,
      schoolId,
      teacherId: user.role === UserRole.TEACHER ? user.id : undefined,
      currentLevel: 1, // Start at level 1 before diagnostic
      currentSubLevel: 0,
      targetLevel: 2,
      aadharMasked: rawAadhar, // Store raw unmasked Aadhar in DB so Superadmin sees it, others get masked dynamically
      levelHistory: [],
      gender: gender || undefined,
      dob: dob || undefined,
      guardianName: guardianName || undefined,
      guardianRelation: guardianRelation || undefined,
      guardianContact: guardianContact || undefined,
      address: address || undefined,
      bloodGroup: bloodGroup || undefined,
      disabilityStatus: disabilityStatus || undefined,
      midDayMealBeneficiary: midDayMealBeneficiary === undefined ? undefined : Boolean(midDayMealBeneficiary),
      busRoute: busRoute || undefined,
      siblingsInSchool: siblingsInSchool || undefined,
    };

    await dbStore.addStudent(newStudent);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: schoolId,
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Onboarded and verified student: ${name}`
    });

    res.json(newStudent);
  });

  // Update Student (Bypass / manual override for demo ease)
  app.patch('/api/students/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { currentLevel, currentSubLevel, targetLevel, levelHistory } = req.body;
    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    await dbStore.updateStudent(student.id, {
      currentLevel: Number(currentLevel),
      currentSubLevel: currentSubLevel !== undefined ? Number(currentSubLevel) : student.currentSubLevel,
      targetLevel: Number(targetLevel),
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

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
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

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
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
  app.post('/api/students/:id/diagnostic/submit', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { questions, answers } = req.body;
    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    // Parse class number from classGroup (e.g. "Class 2" -> 2)
    const classMatch = student.classGroup.match(/\d+/);
    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

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

    // Map answers sequentially (diag_q_X_Y to Q1, Q2, Q3...)
    const pipelineAnswers: { [qId: string]: { answer: string, confidence: number } } = {};
    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const pipelineQId = `Q${qNum}`;
      const submitted = (answers[q.question_id] || '').trim();
      pipelineAnswers[pipelineQId] = {
        answer: String(submitted),
        confidence: 0.95
      };
    });

    const studentResponse = {
      student_id: student.id,
      student_name: student.name,
      enrolled_class: classNumber,
      test_date: dateStr,
      phrase: 'phrase_1',
      exam_id: `C${classNumber}_WORKSHEET_PHRASE_1`,
      answers: pipelineAnswers
    };

    const responsePath = path.join(responseDir, `${student.id}.json`);
    fs.writeFileSync(responsePath, JSON.stringify(studentResponse, null, 2));

    let score = 0;
    let recommendedLevel = 1;
    let narrative = '';

    try {
      const { execFileSync } = await import('child_process');
      console.log(`Running evaluation pipeline for student ${student.id}...`);

      // Run the comparison, evaluation, and report card generation pipeline.
      // execFile (no shell) with array args means classNumber/student.id are passed
      // literally and can never be interpreted as shell syntax.
      execFileSync(PYTHON_BIN, ['run_pipeline.py', String(classNumber), 'phrase_1', student.id], {
        cwd: pipelineDir,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      // If failed, run the personalized exam pipeline too
      try {
        execFileSync(PYTHON_BIN, ['personalized_evaluation_pipeline.py', student.id, String(classNumber), 'phrase_1'], {
          cwd: pipelineDir,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
      } catch (pexErr) {
        console.warn('Personalized exam generation skipped or failed:', pexErr);
      }

      // Read evaluation result JSON and report text
      const evalReportPath = path.join(pipelineDir, 'evaluation_reports', `class_${classNumber}`, 'phrase_1', 'evaluation', `${student.id}_evaluation_${dateStr}.json`);
      const reportTxtPath = path.join(pipelineDir, 'evaluation_reports', `class_${classNumber}`, 'phrase_1', 'reports', `${student.id}_report_${dateStr}.txt`);

      if (fs.existsSync(evalReportPath)) {
        const evalData = JSON.parse(fs.readFileSync(evalReportPath, 'utf-8'));
        score = evalData.total_questions - (evalData.wrong_count || 0);

        const levelStr = String(evalData.demonstrated_level || '1');
        const lvlMatch = levelStr.match(/\d+/);
        if (lvlMatch) {
          const matchedNum = parseInt(lvlMatch[0], 10);
          if (levelStr.toLowerCase().includes('class')) {
            recommendedLevel = (matchedNum - 1) * 10 + 1;
          } else {
            recommendedLevel = matchedNum;
          }
        } else {
          recommendedLevel = 1;
        }
      }

      if (fs.existsSync(reportTxtPath)) {
        narrative = fs.readFileSync(reportTxtPath, 'utf-8');
      }
    } catch (pipelineErr) {
      console.error('Python evaluation pipeline failed, falling back to Gemini AI:', pipelineErr);
      // Fallback to Gemini AI if Python pipeline fails
      const evaluation = await evaluateAIDiagnostic(student.name, questions, answers);
      score = evaluation.score;
      recommendedLevel = evaluation.recommendedLevel;
      narrative = evaluation.narrative;
    }

    // Determine the subLevel based on weakest-level mapping questions
    let subLevel = 0; // default Mastery
    const levelQuestions = questions.filter(q => q.source_level === recommendedLevel);
    if (levelQuestions.length > 0) {
      let failedCount = 0;
      levelQuestions.forEach(q => {
        const submitted = (answers[q.question_id] || '').trim().toLowerCase();
        const correct = q.answer.trim().toLowerCase();
        if (submitted !== correct) {
          failedCount++;
        }
      });

      if (failedCount === levelQuestions.length) {
        subLevel = 2; // Remedial (failed all)
      } else if (failedCount > 0) {
        subLevel = 1; // Easier (failed some)
      } else {
        subLevel = 0; // Mastery
      }
    }

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
      const evalReportPath = path.join(pipelineDir, 'evaluation_reports', `class_${classNumber}`, 'phrase_1', 'evaluation', `${student.id}_evaluation_${dateStr}.json`);
      if (fs.existsSync(evalReportPath)) {
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
      timestamp: new Date().toISOString()
    };

    await dbStore.addEvaluationReport(report);

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

    res.json({ student, evaluation: { score, recommendedLevel, narrative }, report });
  });
}
