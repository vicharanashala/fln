import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { dbStore, connectDB, UserRole, User, Student, School, Question, Worksheet, LevelWorksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Announcement, Intervention, BestPractice } from './db';
import { generateAIDiagnostic, evaluateAIDiagnostic, generateAIPersonalizedWorksheet, evaluateAIWorksheet } from './gemini';
import { generateDiagnosticPaper } from './paperGenerator';
import { generateQuestionsForLevel, generateMultiTopicQuestions } from './levelGenerator';
import { updateConceptMastery, getReinforcementQuestions, mixWorksheetQuestions } from './reinforcementEngine';
import { selectPlacedStudents } from './worksheetBatch';
import * as levelsBackendClient from './levelsBackendClient';
import { randomUUID } from 'crypto';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Python evaluation pipeline: interpreter + location (the pipeline lives in ai-services/,
// a sibling of backend/). Both overridable by env for non-standard deployments.
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const AI_SERVICES_DIR = process.env.AI_SERVICES_DIR || path.resolve(ROOT_DIR, '..', 'ai-services');

// --- Auth config (signed JWTs) ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
if (JWT_SECRET === 'dev-insecure-secret-change-me' && process.env.NODE_ENV === 'production') {
  console.warn('[auth] WARNING: JWT_SECRET is unset in production — set it to a strong random value.');
}

// Strip fields that must never be sent to clients (e.g. the bcrypt password hash).
function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Initialize file-based DB
  await dbStore.init();

  const app = express();
  app.use(express.json());

  // Serve Puppeteer output PDF sheets statically
  app.use('/output', express.static(path.join(ROOT_DIR, 'output')));
  app.get('/output/*', (req, res) => {
    res.status(404).send('PDF Worksheet not found.');
  });
  app.use('/worksheets', express.static(path.join(ROOT_DIR, 'public', 'worksheets')));
  app.get('/worksheets/*', (req, res) => {
    res.status(404).send('Worksheet asset not found.');
  });
  // --- Auth Middleware & Helper ---
  // Verifies the signed JWT issued by /api/auth/login and resolves the current user
  // from the database. There is deliberately NO role synthesis from the email/prefix:
  // only real, seeded users with a valid signed token authenticate.
  function getAuthUser(req: express.Request): User | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;

    let payload: { email?: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { email?: string };
    } catch {
      return null; // invalid signature or expired token
    }
    if (!payload?.email) return null;

    return dbStore.getUserSync(payload.email);
  }

  // --- API Endpoints ---

  // Public stats (no auth required — used by landing page)
  app.get('/api/stats', async (_req, res) => {
    try {
      const [schools, students, users, worksheets] = await Promise.all([
        dbStore.getSchools(),
        dbStore.getStudents(),
        dbStore.getUsers(),
        dbStore.getWorksheets(),
      ]);

      const stateCodes = new Set(schools.map(s => s.stateCode));
      const districtCodes = new Set(schools.map(s => s.districtCode));
      const totalStudents = students.length;
      const avgFlnLevel = totalStudents > 0
        ? Math.round(students.reduce((sum, s) => sum + (s.currentLevel || 0), 0) / totalStudents)
        : 0;
      const certifiedCount = students.filter(s => (s.currentLevel || 0) >= 5).length;

      res.json({
        totalStates: stateCodes.size,
        totalDistricts: districtCodes.size,
        totalSchools: schools.length,
        totalStudents,
        totalAssessments: worksheets.length,
        avgFlnLevel,
        totalUsers: users.length,
        certifiedCount,
        certifiedPercent: totalStudents > 0 ? Math.round((certifiedCount / totalStudents) * 100) : 0,
      });
    } catch (err) {
      console.error('Stats endpoint error:', err);
      res.json({ totalStates: 0, totalDistricts: 0, totalSchools: 0, totalStudents: 0, totalAssessments: 0, avgFlnLevel: 0, totalUsers: 0, certifiedCount: 0, certifiedPercent: 0 });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Verify Password Rules (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements.' });
    }

    // Check if the user is preloaded
    const users = await dbStore.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify the submitted password against the stored bcrypt hash.
    const passwordOk = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Issue a signed JWT; it is verified on every subsequent request (see getAuthUser).
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    return res.json({
      token,
      user: sanitizeUser(user)
    });
  });

  // Auth: Me
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ user: sanitizeUser(user) });
  });

  // Announcements
  app.get('/api/announcements', async (req, res) => {
    const anns = await dbStore.getAnnouncements();
    res.json(anns);
  });

  app.post('/api/announcements/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    const { title, message, isUrgent } = req.body;
    const newAnn: Announcement = {
      id: 'ann_' + Date.now(),
      title,
      message,
      isUrgent: !!isUrgent,
      authorEmail: user.email,
      createdAt: new Date().toISOString()
    };
    await dbStore.addAnnouncement(newAnn);

    // Logging
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: '',
      schoolName: 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Created announcement: ${title}`
    });

    res.json(newAnn);
  });

  // Tickets (In-App Feedback)
  app.get('/api/tickets', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tkts = await dbStore.getTickets();
    if (user.role === UserRole.SUPERADMIN) {
      return res.json(tkts);
    }
    // Filter scoped by role
    const filtered = tkts.filter(t => t.userId === user.id || t.userEmail === user.email);
    res.json(filtered);
  });

  app.post('/api/tickets/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { type, subject, description } = req.body;
    if (type === 'curriculum' && user.role !== UserRole.TEACHER && user.role !== UserRole.VOLUNTEER) {
      return res.status(400).json({ error: 'Curriculum feedback can only be submitted by Teachers or Volunteers.' });
    }

    const newTicket: Ticket = {
      id: 'tkt_' + Date.now(),
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      type: type || 'general',
      subject,
      description,
      status: 'Open',
      createdAt: new Date().toISOString()
    };

    await dbStore.addTicket(newTicket);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: user.schoolId || '',
      schoolName: user.schoolId ? 'Assigned School' : 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'ticket',
      status: 'Success',
      details: `Created feedback ticket: ${subject}`
    });

    res.json(newTicket);
  });

  app.post('/api/tickets/:id/resolve', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    const { status } = req.body; // Reviewed or Resolved
    const updated = await dbStore.updateTicket(req.params.id, { status });
    res.json(updated);
  });

  // Logbook
  app.get('/api/logbook', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const logs = await dbStore.getLogbook();
    res.json(logs);
  });
  // Admin Creation (by Superadmin)
  app.post('/api/admin/create', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }

    const { name, email, password, role, stateCode, districtCode, blockCode, schoolId, assignedSchools } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Verify Password complexity (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements. Must be >= 8 chars and contain uppercase, digit, and special char.' });
    }

    const users = await dbStore.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name,
      email: email.toLowerCase(),
      role: role as UserRole,
      stateCode: stateCode ? stateCode.toUpperCase() : undefined,
      districtCode: districtCode ? districtCode.toUpperCase() : undefined,
      blockCode: blockCode ? blockCode.toUpperCase() : undefined,
      schoolId: schoolId || undefined,
      assignedSchools: assignedSchools || undefined
    };

    await dbStore.addUser(newUser);

    // Add Log entry
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: '',
      schoolName: 'National Framework',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Superadmin created account: ${name} (${role}) for scope ${stateCode || '*'}/${districtCode || '*'}/${blockCode || '*'}`
    });

    res.json(newUser);
  });

  // Schools
  app.get('/api/schools', async (req, res) => {
    const schools = await dbStore.getSchools();
    res.json(schools);
  });

  app.post('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }

    const { id, name, stateCode, districtCode, blockCode, strength } = req.body;
    if (!id || !name || !stateCode || !districtCode || !blockCode) {
      return res.status(400).json({ error: 'Missing required school fields.' });
    }

    const schools = await dbStore.getSchools();
    if (schools.some(s => s.id.toLowerCase() === id.toLowerCase())) {
      return res.status(400).json({ error: 'School ID already exists.' });
    }

    const newSch: School = {
      id: id.toLowerCase(),
      name,
      stateCode: stateCode.toUpperCase(),
      districtCode: districtCode.toUpperCase(),
      blockCode: blockCode.toUpperCase(),
      strength: strength || 'low',
      teachersCount: 0,
      isAccessLocked: false
    };

    await dbStore.addSchool(newSch);

    // Add Log entry
    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: newSch.id,
      schoolName: newSch.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Superadmin onboarded a new school: ${newSch.name} (ID: ${newSch.id})`
    });

    res.json(newSch);
  });

  // Classes
  app.get('/api/classes', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const classes = await dbStore.getClasses();
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
      return res.json(classes);
    }
    const filtered = classes.filter(c => c.schoolId === user.schoolId || (user.assignedSchools && user.assignedSchools.includes(c.schoolId || '')));
    res.json(filtered);
  });

  // Students
  app.get('/api/students', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    
    // Mask Aadhar for non-Superadmins (§13.2 R-6)
    const maskedStudents = students.map(s => {
      if (user.role !== UserRole.SUPERADMIN) {
        return { ...s, aadharMasked: 'XXXX-XXXX-' + s.aadharMasked.slice(-4) };
      }
      return s;
    });

    if (user.role === UserRole.SUPERADMIN) {
      return res.json(students);
    }
    if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      return res.json(maskedStudents.filter(s => s.schoolId === user.schoolId));
    }
    if (user.role === UserRole.VOLUNTEER) {
      return res.json(maskedStudents.filter(s => user.assignedSchools?.includes(s.schoolId)));
    }

    res.json(maskedStudents);
  });

  // Add Student
  app.post('/api/students', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, age, classGroup, section, schoolId, aadharNumber } = req.body;
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
      streak: 0
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

    await dbStore.updateStudent(student.id, {
      currentLevel: Number(currentLevel),
      currentSubLevel: currentSubLevel !== undefined ? Number(currentSubLevel) : student.currentSubLevel,
      targetLevel: Number(targetLevel),
      levelHistory: levelHistory || student.levelHistory
    });

    res.json({ success: true });
  });

  // Run Onboarding AI Diagnostic Test
  app.post('/api/students/:id/diagnostic', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

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
            currentSubLevel: student.currentSubLevel, targetLevel: student.targetLevel,
            streak: student.streak
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
        const lvlQuestions = generateQuestionsForLevel(Math.min(lvl, 59), 0);
        lvlQuestions.forEach(q => {
          questions.push({
            ...q,
            question_id: `DIAG_${lvl}_${q.question_id}`,
            source_level: Math.min(lvl, 59)
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

    // Parse class number from classGroup (e.g. "Class 2" -> 2)
    const classMatch = student.classGroup.match(/\d+/);
    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

    // Connect to Python Evaluation Metrics Pipeline
    const dateStr = new Date().toISOString().split('T')[0];
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
      reason: 'Onboarding Diagnostic Evaluation Placement'
    }];

    await dbStore.updateStudent(student.id, {
      currentLevel: recommendedLevel,
      currentSubLevel: subLevel,
      targetLevel: Math.min(59, recommendedLevel + 1),
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

    // Update rolling concept mastery profile
    try {
      await updateConceptMastery(student.id, questions, answers, dbStore);
    } catch (e) {
      console.error('Failed to update student concept mastery profile after diagnostic:', e);
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

    res.json({ student, evaluation: { score, recommendedLevel, narrative }, report });
  });

  // Generate Personalized Class Worksheets
  app.post('/api/worksheets/generate', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { classId, cycle } = req.body;
    if (!classId || !cycle) {
      return res.status(400).json({ error: 'Class ID and assessment cycle are required.' });
    }

    const classes = await dbStore.getClasses();
    const classObj = classes.find(c => c.id === classId);
    if (!classObj) return res.status(404).json({ error: 'Class not found.' });

    // Check if school is low or high strength
    const schools = await dbStore.getSchools();
    const school = schools.find(s => s.id === classObj.schoolId);
    if (!school) return res.status(404).json({ error: 'School not found.' });

    // Check if Teacher is banned due to Delayed Attempts (§6.5)
    if (user.role === UserRole.TEACHER && user.isBanned) {
      return res.status(403).json({ error: 'Generation Denied: Teacher account is suspended/banned due to 3 Delayed Attempts within the academic year.' });
    }

    // Check if School is locked out entirely (§6.5)
    if (school.isAccessLocked) {
      if (user.role === UserRole.TEACHER || user.role === UserRole.SCHOOL) {
        return res.status(403).json({ error: 'School Access Suspended: All teachers have defaulted. Management is reassigned to Block Admin / Volunteer.' });
      }
    }

    // Check for Generation Lock (§13.2 R-11)
    const existingWorksheets = await dbStore.getWorksheets();
    const conflicting = existingWorksheets.find(w => w.classId === classId && w.cycle === cycle);

    if (conflicting && conflicting.locks.locked) {
      // Enforce pairwise lockouts
      if (school.strength === 'high') {
        // Teacher ↔ School pair
        if (conflicting.locks.lockedByRole !== user.role) {
          return res.status(423).json({
            error: `Lock Active: Generation has already been triggered by ${conflicting.locks.lockedByRole} (${conflicting.locks.lockedByEmail}). Parallel generation is locked.`,
            lockDetails: conflicting.locks
          });
        }
      } else {
        // Volunteer ↔ Block Admin pair
        if (conflicting.locks.lockedByRole !== user.role) {
          return res.status(423).json({
            error: `Lock Active: Generation has already been triggered by ${conflicting.locks.lockedByRole} (${conflicting.locks.lockedByEmail}). Parallel generation is locked.`,
            lockDetails: conflicting.locks
          });
        }
      }
    }

    // Generate personalized questions for every student in the class
    const students = await dbStore.getStudents();
    const classStudents = students.filter(s => s.classGroup === classObj.className && s.section === classObj.section && s.schoolId === classObj.schoolId);

    console.log(`[Worksheet Gen Log] Selected ${classStudents.length} student(s) for class ${classObj.className} ${classObj.section} worksheet generation.`);
    if (classStudents.length === 0) {
      return res.status(400).json({ error: 'No students found in this class roster.' });
    }

    // Compile distinct personalized questions per student based on level and sub-level
    const compiledQuestions: Question[] = [];

    for (const student of classStudents) {
      const subLvl = student.currentSubLevel || 0;
      let reinfQs: Question[] = [];
      try {
        reinfQs = await getReinforcementQuestions(student.id, student.currentLevel, dbStore);
      } catch (reinfErr) {
        console.error(`Failed to generate reinforcement questions for student ${student.id}:`, reinfErr);
      }

      // Calculate the number of normal questions needed to maintain 10-20% reinforcement ratio
      // If R is the number of reinforcement questions, then R / (N + R) <= 0.20 => N >= 4 * R
      const normalCount = Math.max(4, reinfQs.length * 4);
      
      const qs = generateMultiTopicQuestions(student.currentLevel, subLvl, normalCount);
      console.log(`[Worksheet Gen Log] Student: ${student.name} (${student.id}) | Current Level: ${student.currentLevel}.${subLvl} | Generated ${qs.length} standard questions (Multi-topic).`);
      
      // Map question IDs to be student-specific to prevent duplicate collisions
      qs.forEach(q => {
        compiledQuestions.push({
          ...q,
          question_id: `${student.id}_${q.question_id}`,
          question: `[For ${student.name} - L${student.currentLevel}.${subLvl}] ${q.question}`
        });
      });

      if (reinfQs.length > 0) {
        console.log(`[Worksheet Gen Log] Student: ${student.name} (${student.id}) | Injecting ${reinfQs.length} reinforcement question(s).`);
        const mappedReinforcement = reinfQs.map(q => ({
            ...q,
            question_id: `${student.id}_REINF_${q.question_id}`,
            question: `[For ${student.name}] ${q.question}`
          }));
        const studentQuestions = compiledQuestions.splice(compiledQuestions.length - qs.length, qs.length);
        compiledQuestions.push(...mixWorksheetQuestions(studentQuestions, mappedReinforcement));
      } else {
        console.log(`[Worksheet Gen Log] Student: ${student.name} (${student.id}) | No reinforcement questions generated.`);
      }
    }

    // Setup strict Timing Windows (§1.4 Sequential timings)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Check if other worksheets exist for the same school on the same day to make print windows sequential & non-overlapping
    const sameDayWorksheets = existingWorksheets.filter(w => w.schoolId === classObj.schoolId && w.date === todayStr);
    
    let printStart = new Date(now.getTime());
    if (sameDayWorksheets.length > 0) {
      // Find the latest printWindowEnd
      const latestEnd = new Date(Math.max(...sameDayWorksheets.map(w => new Date(w.timing.printWindowEnd).getTime())));
      if (latestEnd.getTime() > now.getTime()) {
        printStart = latestEnd;
      }
    }

    const printEnd = new Date(printStart.getTime() + 60 * 60 * 1000); // 1 hour print window
    const examStart = new Date(printEnd.getTime());
    const examEnd = new Date(examStart.getTime() + 45 * 60 * 1000); // 45 mins exam
    const submissionEnd = new Date(examEnd.getTime() + 60 * 60 * 1000); // 1 hour upload

    const newWorksheet: Worksheet = {
      id: 'WS_' + Math.floor(1000 + Math.random() * 9000),
      classId,
      className: classObj.className,
      section: classObj.section,
      schoolId: classObj.schoolId,
      generatedByRole: user.role,
      generatedByEmail: user.email,
      cycle,
      date: todayStr,
      questions: compiledQuestions,
      locks: {
        locked: true,
        lockedByRole: user.role,
        lockedByEmail: user.email,
        timestamp: now.toISOString()
      },
      timing: {
        examDate: todayStr,
        printWindowStart: printStart.toISOString(),
        printWindowEnd: printEnd.toISOString(),
        examWindowStart: examStart.toISOString(),
        examWindowEnd: examEnd.toISOString(),
        submissionWindowEnd: submissionEnd.toISOString()
      },
      delayLogs: {
        delayedAttemptsCount: 0,
        submittingTeachers: []
      }
    };

    await dbStore.addWorksheet(newWorksheet);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: now.toISOString(),
      schoolId: classObj.schoolId,
      schoolName: school.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'download',
      status: 'Success',
      details: `Generated personalized worksheets for ${classObj.className} ${classObj.section}. Locked pairwise role.`
    });

    res.json(newWorksheet);
  });

  // Generate printable PDF for an existing worksheet (connects 59 FLN levels with diagnostic pipeline)
  app.post('/api/worksheets/generate-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { worksheetId } = req.body;
    if (!worksheetId) {
      return res.status(400).json({ error: 'worksheetId is required.' });
    }

    const worksheets = await dbStore.getWorksheets();
    const ws = worksheets.find(w => w.id === worksheetId);
    if (!ws) return res.status(404).json({ error: 'Worksheet not found.' });

    const students = await dbStore.getStudents();
    const classStudents = students.filter(
      s => s.classGroup === ws.className && s.section === ws.section && s.schoolId === ws.schoolId
    );

    const studentsWithQuestions = classStudents.map(s => {
      const studentQuestions = ws.questions.filter(q => q.question_id.startsWith(s.id + '_'));
      return {
        studentId: s.id,
        name: s.name,
        currentLevel: s.currentLevel,
        currentSubLevel: s.currentSubLevel || 0,
        questions: studentQuestions
      };
    }).filter(s => s.questions.length > 0);

    if (studentsWithQuestions.length === 0) {
      return res.status(400).json({ error: 'No student questions found in this worksheet.' });
    }

    try {
      const { renderWorksheetPdf } = await import('./paperGenerator');
      const result = await renderWorksheetPdf({
        worksheetId,
        className: ws.className,
        section: ws.section,
        cycle: ws.cycle,
        studentsWithQuestions
      });
      res.json({ success: true, pdfUrl: result.pdfUrl });
    } catch (err: any) {
      console.error('Worksheet PDF generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Shared pipeline: build a roster -> Levels_backend /api/generate-batch ->
   * poll /api/batch-status -> /api/download-batch (zip) -> unpack
   * worksheet.pdf + answer_key.json + coords.json -> save PDF into this
   * backend's own /output (served statically) and persist a LevelWorksheet
   * record (with the real answer key + OMR coords) per rendered file.
   *
   * Students are matched back to rendered files via the roster's
   * `rollNumber` field, which we deliberately set to the student's stable
   * internal id (this codebase has no separate roll-number field on
   * Student) — Levels_backend echoes the original rollNumber back in its
   * manifest.json per file, so the mapping is exact regardless of how it
   * sanitizes folder names.
   */
  async function generateLevelWorksheetsViaLevelsBackend(
    students: Student[],
    _opts: { includeBatchId?: boolean } = {}
  ): Promise<Array<{
    studentId: string;
    studentName: string;
    batchId: string;
    sublevelId: string;
    setNum: number;
    pdfUrl: string;
  }>> {
    const roster: levelsBackendClient.RosterEntry[] = await Promise.all(students.map(async s => {
      let reinfQs: Question[] = [];
      try {
        reinfQs = await getReinforcementQuestions(s.id, s.currentLevel, dbStore);
      } catch (err) {
        console.error(`Error getting reinforcement questions for student ${s.id}:`, err);
      }
      return {
        studentName: s.name,
        rollNumber: s.id,
        levelId: s.currentLevel,
        sublevelId: `${s.currentLevel}.${s.currentSubLevel ?? 0}`,
        setsPerSub: 1,
        studentData: {
          age: s.age, classGroup: s.classGroup, section: s.section, schoolId: s.schoolId,
          currentLevel: s.currentLevel, currentSubLevel: s.currentSubLevel,
          targetLevel: s.targetLevel, streak: s.streak,
          reinforcementQuestions: reinfQs
        }
      };
    }));

    const batchResult = await levelsBackendClient.generateBatch(roster);
    await levelsBackendClient.waitForBatch(batchResult.batchId);
    const zipBuffer = await levelsBackendClient.downloadBatchZip(batchResult.batchId);
    const { manifest, files } = await levelsBackendClient.extractBatchZip(zipBuffer);

    // groupKey ("<studentFolder>/<sublevelId>_set<n>") -> original rollNumber (== studentId)
    const rollNumberByGroupKey = new Map<string, string>();
    if (manifest && Array.isArray(manifest.students)) {
      for (const ms of manifest.students) {
        if (!Array.isArray(ms.files)) continue;
        for (const f of ms.files) {
          rollNumberByGroupKey.set(f.folder, ms.rollNumber);
        }
      }
    }

    const studentsById = new Map(students.map(s => [s.id, s]));
    const localOutputDir = path.join(ROOT_DIR, 'output');
    if (!fs.existsSync(localOutputDir)) fs.mkdirSync(localOutputDir, { recursive: true });

    const out: Array<{ studentId: string; studentName: string; batchId: string; sublevelId: string; setNum: number; pdfUrl: string }> = [];

    for (const file of files) {
      const groupKey = `${file.studentFolder}/${file.sublevelId}_set${file.setNum}`;
      const studentId = rollNumberByGroupKey.get(groupKey);
      const student = studentId ? studentsById.get(studentId) : undefined;
      if (!student) {
        console.warn(`[levels-backend] Could not map rendered file back to a student: ${groupKey}`);
        continue;
      }

      const fileName = `level_${student.currentLevel}_${file.sublevelId}_set${file.setNum}_${student.id}_${randomUUID()}.pdf`;
      const filePath = path.join(localOutputDir, fileName);
      fs.writeFileSync(filePath, file.pdfBuffer);
      const pdfUrl = `/output/${fileName}`;

      // Write corresponding JSONs alongside the PDF for single/batch files
      const baseName = fileName.replace(/\.pdf$/, '');
      if (file.answerKey) {
        fs.writeFileSync(path.join(localOutputDir, `${baseName}_answer_key.json`), JSON.stringify(file.answerKey, null, 2));
      }
      if (file.coords) {
        fs.writeFileSync(path.join(localOutputDir, `${baseName}_coords.json`), JSON.stringify(file.coords, null, 2));
      }
      if (file.questionPaper) {
        fs.writeFileSync(path.join(localOutputDir, `${baseName}_question_paper.json`), JSON.stringify(file.questionPaper, null, 2));
      }

      const record: LevelWorksheet = {
        id: 'LW_' + randomUUID(),
        batchId: batchResult.batchId,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.id,
        levelId: student.currentLevel,
        sublevelId: file.sublevelId,
        setNum: file.setNum,
        pdfUrl,
        answerKey: file.answerKey,
        coords: file.coords,
        generatedAt: new Date().toISOString()
      };
      await dbStore.addLevelWorksheet(record);

      out.push({
        studentId: student.id,
        studentName: student.name,
        batchId: batchResult.batchId,
        sublevelId: file.sublevelId,
        setNum: file.setNum,
        pdfUrl
      });
    }

    const generatedStudentIds = new Set(out.map(item => item.studentId));
    const missingStudents = students.filter(student => !generatedStudentIds.has(student.id));
    if (missingStudents.length > 0) {
      throw new Error(`Levels backend did not generate worksheets for placed students: ${missingStudents.map(student => student.id).join(', ')}`);
    }

    return out;
  }

  // Helper to gather all unique question texts previously seen/attempted by a student
  async function getUsedQuestionsForStudent(studentId: string): Promise<Set<string>> {
    const usedTexts = new Set<string>();

    try {
      // 1. Get from all worksheets in db
      const worksheets = await dbStore.getWorksheets();
      for (const ws of worksheets) {
        if (ws.questions) {
          for (const q of ws.questions) {
            if (q.question_id.startsWith(studentId + '_')) {
              const cleanText = q.question.replace(/^\[For [^\]]+\]\s*/, '').trim().toLowerCase();
              usedTexts.add(cleanText);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load used questions from worksheets for ${studentId}:`, e);
    }

    try {
      // 2. Get from all level worksheets in db
      const levelWorksheets = await dbStore.getLevelWorksheets();
      const studentLWs = levelWorksheets.filter(lw => lw.studentId === studentId);
      for (const lw of studentLWs) {
        if (lw.pdfUrl) {
          const baseName = path.basename(lw.pdfUrl, '.pdf');
          const jsonPath = path.join(ROOT_DIR, 'output', `${baseName}_question_paper.json`);
          if (fs.existsSync(jsonPath)) {
            try {
              const paperData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              if (Array.isArray(paperData)) {
                paperData.forEach((q: any) => {
                  if (q.question) {
                    const cleanText = q.question.replace(/^\[For [^\]]+\]\s*/, '').trim().toLowerCase();
                    usedTexts.add(cleanText);
                  }
                });
              }
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load used questions from level worksheets for ${studentId}:`, e);
    }

    return usedTexts;
  }

  // Helper to generate multi-topic questions that have never been seen by the student
  function generateFreshMultiTopicQuestions(
    targetLevel: number,
    subLevel: number,
    count: number,
    usedTexts: Set<string>
  ): Question[] {
    const selectedQuestions: Question[] = [];
    const coveredTopics = new Set<string>();
    
    let attempts = 0;
    while (selectedQuestions.length < count && attempts < 50) {
      attempts++;
      for (let lvl = targetLevel; lvl >= 1 && selectedQuestions.length < count; lvl--) {
        const levelQs = generateQuestionsForLevel(lvl, subLevel);
        if (levelQs.length > 0) {
          const topic = levelQs[0].topic.toLowerCase();
          if (!coveredTopics.has(topic)) {
            const candidate = levelQs[Math.floor(Math.random() * levelQs.length)];
            const cleanText = candidate.question.trim().toLowerCase();
            
            if (!usedTexts.has(cleanText) && !selectedQuestions.some(sq => sq.question === candidate.question)) {
              coveredTopics.add(topic);
              selectedQuestions.push(candidate);
            }
          }
        }
      }
    }

    attempts = 0;
    while (selectedQuestions.length < count && attempts < 50) {
      attempts++;
      for (let lvl = targetLevel; lvl >= 1 && selectedQuestions.length < count; lvl--) {
        const fillQs = generateQuestionsForLevel(lvl, subLevel);
        for (const q of fillQs) {
          if (selectedQuestions.length >= count) break;
          const cleanText = q.question.trim().toLowerCase();
          if (!usedTexts.has(cleanText) && !selectedQuestions.some(sq => sq.question === q.question)) {
            selectedQuestions.push(q);
          }
        }
      }
    }

    // Absolute fallback
    if (selectedQuestions.length < count) {
      const backup = generateMultiTopicQuestions(targetLevel, subLevel, count);
      for (const q of backup) {
        if (selectedQuestions.length >= count) break;
        if (!selectedQuestions.some(sq => sq.question === q.question)) {
          selectedQuestions.push(q);
        }
      }
    }

    return selectedQuestions;
  }

  // Generate Personalized Level-Wise Worksheet PDF for a single student.
  app.post('/api/worksheets/generate-level-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required.' });
    }

    try {
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      if (student.currentLevel == null) {
        return res.status(400).json({ error: 'Student has not completed their diagnostic test.' });
      }

      const { generateLevelWorksheet } = await import('./paperGenerator');
      const localOutputDir = path.join(ROOT_DIR, 'output');
      const usedTexts = await getUsedQuestionsForStudent(student.id);
      
      let reinfQs: Question[] = [];
      try {
        reinfQs = await getReinforcementQuestions(student.id, student.currentLevel, dbStore, usedTexts);
      } catch (reinfErr) {
        console.error(`Failed to generate reinforcement questions for student ${student.id}:`, reinfErr);
      }
      
      const subLvl = student.currentSubLevel || 0;
      const normalCount = Math.max(4, reinfQs.length * 4);
      const qs = generateFreshMultiTopicQuestions(student.currentLevel, subLvl, normalCount, usedTexts);
      
      let studentQs = qs.map(q => ({
        ...q,
        question_id: `${student.id}_${q.question_id}`,
        question: `[For ${student.name} - L${student.currentLevel}.${subLvl}] ${q.question}`
      }));

      if (reinfQs.length > 0) {
        const mappedReinforcement = reinfQs.map(q => ({
            ...q,
            question_id: `${student.id}_REINF_${q.question_id}`,
            question: `[For ${student.name}] [REINFORCEMENT] ${q.question}`
          }));
        studentQs = mixWorksheetQuestions(studentQs, mappedReinforcement);
      }

      const result = await generateLevelWorksheet({
        studentId: student.id,
        studentName: student.name,
        levelId: student.currentLevel,
        subIdx: subLvl,
        questions: studentQs
      });

      // Write corresponding JSONs alongside the PDF for single files so that answers are saved
      const baseName = result.fileName.replace(/\.pdf$/, '');
      fs.writeFileSync(path.join(localOutputDir, `${baseName}_question_paper.json`), JSON.stringify(studentQs, null, 2));

      res.json({ success: true, pdfUrl: result.pdfUrl });
    } catch (err: any) {
      console.error('Level worksheet generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate Personalized Level-Wise Worksheets for a whole roster of students in ONE batch call
  app.post('/api/worksheets/generate-level-batch', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds must be a non-empty array.' });
    }

    try {
      const students = await dbStore.getStudents();
      const { targets, skipped } = selectPlacedStudents(students, studentIds);

      console.log(`[Level Batch Gen Log] Beginning level-wise batch generation for ${studentIds.length} student IDs.`);
      for (const student of targets) {
        console.log(`[Level Batch Gen Log] Selected student ${student.name} (${student.id}) at level ${student.currentLevel}.${student.currentSubLevel || 0} for batch generation.`);
      }

      if (targets.length === 0) {
        return res.status(400).json({ error: 'No eligible (placed) students in this request.', skipped });
      }

      const generated: Array<any> = [];
      const fallbackBatchId = `fallback_${Date.now()}`;
      
      const { generateLevelWorksheet } = await import('./paperGenerator');
      const localOutputDir = path.join(ROOT_DIR, 'output');
      
      for (const student of targets) {
        try {
          const subLvl = student.currentSubLevel || 0;
          const usedTexts = await getUsedQuestionsForStudent(student.id);
          
          let reinfQs: Question[] = [];
          try {
            reinfQs = await getReinforcementQuestions(student.id, student.currentLevel!, dbStore, usedTexts);
          } catch (reinfErr) {
            console.error(`Failed to generate reinforcement questions for student ${student.id}:`, reinfErr);
          }
          
          const normalCount = Math.max(4, reinfQs.length * 4);
          const qs = generateFreshMultiTopicQuestions(student.currentLevel!, subLvl, normalCount, usedTexts);
          
          let studentQs = qs.map(q => ({
            ...q,
            question_id: `${student.id}_${q.question_id}`,
            question: `[For ${student.name} - L${student.currentLevel}.${subLvl}] ${q.question}`
          }));

          if (reinfQs.length > 0) {
            const mappedReinforcement = reinfQs.map(q => ({
                ...q,
                question_id: `${student.id}_REINF_${q.question_id}`,
                question: `[For ${student.name}] [REINFORCEMENT] ${q.question}`
              }));
            studentQs = mixWorksheetQuestions(studentQs, mappedReinforcement);
          }

          const result = await generateLevelWorksheet({
            studentId: student.id,
            studentName: student.name,
            levelId: student.currentLevel!,
            subIdx: subLvl,
            questions: studentQs
          });
          
          // Write corresponding JSONs alongside the PDF for single/batch files
          const baseName = result.fileName.replace(/\.pdf$/, '');
          fs.writeFileSync(path.join(localOutputDir, `${baseName}_question_paper.json`), JSON.stringify(studentQs, null, 2));
          
          generated.push({
            studentId: student.id,
            studentName: student.name,
            batchId: fallbackBatchId,
            sublevelId: `${student.currentLevel}.${subLvl}`,
            setNum: 1,
            pdfUrl: result.pdfUrl,
            questions: studentQs
          });
          
          // Add LevelWorksheet record to dbStore
          const record: LevelWorksheet = {
            id: 'LW_' + crypto.randomUUID(),
            batchId: fallbackBatchId,
            studentId: student.id,
            studentName: student.name,
            rollNumber: student.id,
            levelId: student.currentLevel!,
            sublevelId: `${student.currentLevel}.${subLvl}`,
            setNum: 1,
            pdfUrl: result.pdfUrl,
            answerKey: Object.fromEntries(studentQs.map(q => [q.question_id, q.answer])),
            coords: {},
            generatedAt: new Date().toISOString()
          };
          await dbStore.addLevelWorksheet(record);
          console.log(`[Level Batch Gen Log] Fallback generated PDF and ${studentQs.length} questions for ${student.name} (${student.id}).`);
        } catch (err: any) {
          console.error(`Fallback generation failed for student ${student.id}:`, err);
          skipped.push({ studentId: student.id, reason: err.message });
        }
      }
      console.log(`[Level Batch Gen Log] Optimized PDF fallback complete: ${generated.length} students processed, ${skipped.length} skipped.`);

      const results = generated.map(g => ({
        studentId: g.studentId,
        studentName: g.studentName,
        sublevelId: g.sublevelId,
        setNum: g.setNum,
        pdfUrl: g.pdfUrl
      }));

      res.json({
        success: true,
        batchId: generated[0]?.batchId || null,
        studentsProcessed: targets.length - skipped.length,
        totalFiles: generated.length,
        results,
        skipped
      });
    } catch (err: any) {
      console.error('Level-wise batch generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Streams the raw batch ZIP straight from Levels_backend or dynamic local ZIP
  app.get('/api/worksheets/download-batch/:batchId', async (req, res) => {
    try {
      const batchId = req.params.batchId;
      if (batchId.startsWith('fallback_')) {
        // Build ZIP dynamically from local files using jszip
        const JSZip = (await import('jszip')).default;
        const dynamicZip = new JSZip();
        
        const levelWorksheets = await dbStore.getLevelWorksheets();
        const batchWorksheets = levelWorksheets.filter(lw => lw.batchId === batchId);
        
        if (batchWorksheets.length === 0) {
          return res.status(404).json({ error: 'Local batch worksheets not found.' });
        }
        
        const outputDir = path.join(ROOT_DIR, 'output');
        for (const lw of batchWorksheets) {
          const fileName = path.basename(lw.pdfUrl);
          const filePath = path.join(outputDir, fileName);
          if (fs.existsSync(filePath)) {
            const pdfBuffer = fs.readFileSync(filePath);
            dynamicZip.file(fileName, pdfBuffer);
          }
        }
        
        const zipBuffer = await dynamicZip.generateAsync({ type: 'nodebuffer' });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}.zip"`);
        return res.send(zipBuffer);
      }
      
      const zipBuffer = await levelsBackendClient.downloadBatchZip(req.params.batchId);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="batch_${req.params.batchId}.zip"`);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Batch ZIP download failed:', err);
      res.status(502).json({ error: err.message });
    }
  });

  // Submit Completed Worksheet (ICR Structured Ingestion) & Scoring Engine
  app.post('/api/evaluation/submit', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { worksheetId, studentId, answers } = req.body;
    if (!worksheetId || !studentId || !answers) {
      return res.status(400).json({ error: 'Worksheet ID, Student ID, and answer map are required.' });
    }

    const worksheets = await dbStore.getWorksheets();
    const ws = worksheets.find(w => w.id === worksheetId);
    if (!ws) return res.status(404).json({ error: 'Worksheet not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Handle Timings & Delayed Attempt Escalation (§6.5)
    const now = new Date();
    const submissionDeadline = new Date(ws.timing.submissionWindowEnd);
    const isDelayed = now.getTime() > submissionDeadline.getTime();

    // Grade and generate AI narrative using Gemini AI
    const studentQuestions = ws.questions.filter(q => q.question_id.startsWith(student.id + '_'));
    const evaluation = await evaluateAIWorksheet(student.name, student.currentLevel, studentQuestions, answers);

    // Determine subLevel based on question performance at the recommended level
    let newSubLevel = 0; // default Mastery
    const recLevel = evaluation.recommendedLevel;
    const levelQs = studentQuestions.filter(q => q.source_level === recLevel);
    if (levelQs.length > 0) {
      let failedCount = 0;
      levelQs.forEach(q => {
        const submitted = (answers[q.question_id] || '').trim().toLowerCase();
        const correct = q.answer.trim().toLowerCase();
        if (submitted !== correct) failedCount++;
      });
      if (failedCount === levelQs.length) {
        newSubLevel = 2; // Remedial
      } else if (failedCount > 0) {
        newSubLevel = 1; // Easier
      }
    }

    // Save submission
    const submission: AnswerSubmission = {
      id: 'sub_' + student.id + '_' + Date.now(),
      worksheetId,
      studentId,
      studentName: student.name,
      schoolId: ws.schoolId,
      classId: ws.classId,
      submittedAt: now.toISOString(),
      isDelayed,
      answers
    };

    await dbStore.addAnswerSubmission(submission);

    // Save Evaluation Report
    const report: EvaluationReport = {
      id: 'rep_' + student.id + '_' + Date.now(),
      studentId,
      worksheetId,
      score: evaluation.score,
      totalQuestions: studentQuestions.length,
      conceptMastery: evaluation.conceptMastery,
      narrative: evaluation.narrative,
      recommendedLevel: evaluation.recommendedLevel,
      recommendedSubLevel: newSubLevel,
      timestamp: now.toISOString()
    };

    await dbStore.addEvaluationReport(report);

    // Update rolling concept mastery profile
    try {
      await updateConceptMastery(student.id, studentQuestions, answers, dbStore);
    } catch (e) {
      console.error('Failed to update student concept mastery profile after worksheet submission:', e);
    }

    // If correct, update student levels
    const levelHistory = [...student.levelHistory];
    if (evaluation.recommendedLevel !== student.currentLevel || newSubLevel !== (student.currentSubLevel || 0)) {
      levelHistory.push({
        level: evaluation.recommendedLevel,
        subLevel: newSubLevel,
        date: now.toISOString().split('T')[0],
        reason: `Performance on ${ws.cycle} exam worksheet`
      });
    }

    await dbStore.updateStudent(student.id, {
      currentLevel: evaluation.recommendedLevel,
      currentSubLevel: newSubLevel,
      targetLevel: Math.min(59, evaluation.recommendedLevel + 1),
      levelHistory,
      streak: student.streak + 1
    });

    // Logging & escalation updates if delayed
    if (isDelayed) {
      ws.delayLogs.delayedAttemptsCount++;
      if (!ws.delayLogs.submittingTeachers.includes(user.email)) {
        ws.delayLogs.submittingTeachers.push(user.email);
      }
      await dbStore.updateWorksheet(ws.id, { delayLogs: ws.delayLogs });

      // Increment Teacher's delay count & enforce Defaulter status (§6.5)
      const users = await dbStore.getUsers();
      const teacherUser = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (teacherUser && teacherUser.role === UserRole.TEACHER) {
        const curDelays = (teacherUser.delayedAttemptsCount || 0) + 1;
        const shouldBan = curDelays >= 3;
        await dbStore.updateUser(teacherUser.id, {
          delayedAttemptsCount: curDelays,
          isBanned: shouldBan
        });

        // Lock school access if all teachers in this school default
        if (shouldBan && teacherUser.schoolId) {
          const schoolTeachers = users.filter(u => u.role === UserRole.TEACHER && u.schoolId === teacherUser.schoolId);
          const allBanned = schoolTeachers.every(t => t.isBanned || t.id === teacherUser.id);
          if (allBanned && schoolTeachers.length > 0) {
            await dbStore.updateSchool(teacherUser.schoolId, { isAccessLocked: true });
          }
        }
      }

      await dbStore.addLog({
        id: 'log_' + Date.now(),
        timestamp: now.toISOString(),
        schoolId: ws.schoolId,
        schoolName: 'GPS',
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        activityType: 'scan',
        status: 'Delayed',
        details: `SUBMISSION DELAYED: Answers for ${student.name} uploaded after the 1-hour submission window closed.`
      });
    } else {
      await dbStore.addLog({
        id: 'log_' + Date.now(),
        timestamp: now.toISOString(),
        schoolId: ws.schoolId,
        schoolName: 'GPS',
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        activityType: 'scan',
        status: 'Success',
        details: `Successfully evaluated assessment sheet for ${student.name}.`
      });
    }

    // Auto-detect intervention outcomes
    const interventions = await dbStore.getInterventions();
    const activeInterventions = interventions.filter(
      i => i.studentId === studentId && i.status === 'active' && !i.outcome
    );
    for (const intv of activeInterventions) {
      const improved = evaluation.recommendedLevel > intv.currentLevel;
      await dbStore.updateIntervention(intv.id, {
        status: 'completed',
        endDate: now.toISOString().split('T')[0],
        outcome: {
          improved,
          previousLevel: intv.currentLevel,
          newLevel: evaluation.recommendedLevel,
          improvementDetails: improved
            ? `Auto-detected: Student improved from Level ${intv.currentLevel} to Level ${evaluation.recommendedLevel} after intervention targeting ${intv.weakCompetencies.join(', ')}.`
            : `Auto-detected: Student remained at Level ${intv.currentLevel} after intervention. Further remediation may be needed.`,
          assessmentId: report.id,
          detectedAt: now.toISOString()
        }
      });
    }

    res.json({ submission, report, evaluation });
  });

  // Evaluation History
  app.get('/api/evaluation/:studentId/history', async (req, res) => {
    const reps = await dbStore.getEvaluationReports();
    const filtered = reps.filter(r => r.studentId === req.params.studentId);
    res.json(filtered);
  });

  // Concept Mastery Profile
  app.get('/api/students/:id/concept-mastery', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const profile = await dbStore.getConceptMasteryProfile(req.params.id);
      if (!profile) {
        // Return a fresh empty profile structure if not assessed yet
        return res.json({
          studentId: req.params.id,
          concepts: [],
          updatedAt: new Date().toISOString()
        });
      }
      res.json(profile);
    } catch (err: any) {
      console.error('Failed to retrieve concept mastery profile:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Roll up Analytics for Dashboards scoped by Role (§14)
  app.get('/api/analytics', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const schools = await dbStore.getSchools();
    const worksheets = await dbStore.getWorksheets();
    const reports = await dbStore.getEvaluationReports();

    // Query params for dynamic filtering
    const stateCodeParam = (req.query.stateCode as string) || user.stateCode || 'PB';
    const districtCodeParam = (req.query.districtCode as string) || user.districtCode || 'LDH';
    const blockCodeParam = (req.query.blockCode as string) || user.blockCode || 'LDH-01';

    // Map geographical attributes to students
    const studentsWithGeo = students.map(s => {
      const sch = schools.find(x => x.id === s.schoolId);
      return {
        ...s,
        stateCode: sch?.stateCode || '',
        districtCode: sch?.districtCode || '',
        blockCode: sch?.blockCode || ''
      };
    });

    const getScopeMetrics = (filteredStudents: typeof studentsWithGeo) => {
      const count = filteredStudents.length;
      if (count === 0) {
        return {
          avgLevel: 0,
          certificationRate: 0,
          topicMastery: {
            "Number Sense": 0,
            "Number Operations": 0,
            "Shapes": 0,
            "Fractions": 0,
            "Patterns": 0,
            "Measurement": 0
          },
          levelDistribution: Object.fromEntries(
            Array.from({ length: 15 }, (_, i) => [`Level ${i + 1}`, 0])
              .concat([["Level 16+", 0]])
          )
        };
      }
      const sumLevel = filteredStudents.reduce((acc, s) => acc + s.currentLevel, 0);
      const avgLevel = Math.round((sumLevel / count) * 10) / 10;
      const certified = filteredStudents.filter(s => s.currentLevel >= 5).length;
      const certificationRate = Math.round((certified / count) * 100);

      // Create stable topic mastery values that reflect the current average level
      const avgCurrentLevel = sumLevel / count;
      const topicMastery = {
        "Number Sense": Math.min(100, Math.round(55 + avgCurrentLevel * 8)),
        "Number Operations": Math.min(100, Math.round(45 + avgCurrentLevel * 9)),
        "Shapes": Math.min(100, Math.round(58 + avgCurrentLevel * 7)),
        "Fractions": Math.min(100, Math.round(20 + avgCurrentLevel * 11)),
        "Patterns": Math.min(100, Math.round(38 + avgCurrentLevel * 10)),
        "Measurement": Math.min(100, Math.round(32 + avgCurrentLevel * 10))
      };

      const levelDistribution: Record<string, number> = {};
      for (let i = 1; i <= 15; i++) {
        levelDistribution[`Level ${i}`] = filteredStudents.filter((s: any) => s.currentLevel === i).length;
      }
      levelDistribution["Level 16+"] = filteredStudents.filter((s: any) => s.currentLevel >= 16).length;

      return {
        avgLevel,
        certificationRate,
        topicMastery,
        levelDistribution
      };
    };

    // Calculate dynamic scopes
    const national = getScopeMetrics(studentsWithGeo);
    const state = getScopeMetrics(studentsWithGeo.filter(s => s.stateCode === stateCodeParam));
    const district = getScopeMetrics(studentsWithGeo.filter(s => s.districtCode === districtCodeParam));
    const block = getScopeMetrics(studentsWithGeo.filter(s => s.blockCode === blockCodeParam));

    // Compute high-level general metrics
    const totalStudents = students.length;
    const totalSchools = schools.length;
    const totalWorksheets = worksheets.length;
    const certifiedCount = students.filter(s => s.currentLevel >= 5).length;
    const certificationPercent = totalStudents > 0 ? Math.round((certifiedCount / totalStudents) * 100) : 0;

    const pipeline = {
      conducted: worksheets.length * 10,
      scanned: reports.length,
      evaluated: reports.length,
      certified: certifiedCount
    };

    res.json({
      totalStudents,
      totalSchools,
      totalWorksheets,
      certificationPercent,
      pipeline,
      roleScope: user.role,
      national,
      state,
      district,
      block
    });
  });

  // Get active coordinators/administrators
  app.get('/api/admin/coordinators', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const users = await dbStore.getUsers();
    // Return all users for audit and coordination (without password hashes).
    res.json(users.map(sanitizeUser));
  });

  // Revive Banned Teacher (§6.5)
  app.post('/api/admin/revive-teacher', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'Teacher ID is required.' });

    const users = await dbStore.getUsers();
    const teacher = users.find(u => u.id === teacherId && u.role === UserRole.TEACHER);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    await dbStore.updateUser(teacher.id, {
      delayedAttemptsCount: 0,
      isBanned: false
    });

    if (teacher.schoolId) {
      const schoolTeachers = users.filter(u => u.role === UserRole.TEACHER && u.schoolId === teacher.schoolId);
      const anyBanned = schoolTeachers.some(t => t.isBanned && t.id !== teacher.id);
      if (!anyBanned) {
        await dbStore.updateSchool(teacher.schoolId, { isAccessLocked: false });
      }
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: teacher.schoolId || 'N/A',
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Revived teacher ${teacher.name} (${teacher.email}) resetting delayed attempts.`
    });

    res.json({ success: true, message: 'Teacher successfully revived.' });
  });

  // Restore School Access (§6.5)
  app.post('/api/admin/restore-school', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [UserRole.SUPERADMIN, UserRole.ADMIN];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    const { schoolId } = req.body;
    if (!schoolId) return res.status(400).json({ error: 'School ID is required.' });

    const schools = await dbStore.getSchools();
    const school = schools.find(s => s.id === schoolId);
    if (!school) return res.status(404).json({ error: 'School not found.' });

    await dbStore.updateSchool(schoolId, { isAccessLocked: false });

    // Revive all teachers in this school
    const users = await dbStore.getUsers();
    const schoolTeachers = users.filter(u => u.role === UserRole.TEACHER && u.schoolId === schoolId);
    for (const teacher of schoolTeachers) {
      await dbStore.updateUser(teacher.id, {
        delayedAttemptsCount: 0,
        isBanned: false
      });
    }

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: schoolId,
      schoolName: school.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Manually restored school access for school: ${school.name}`
    });

    res.json({ success: true, message: 'School access manually restored.' });
  });

  // ══════════════════════════════════════════
  // DATABASE RESET (Superadmin only)
  // ══════════════════════════════════════════
  // Wipes every collection and re-seeds. Requires an authenticated superadmin.
  // Deliberately POST-only: a GET reset was removed because it let any prefetch,
  // crawler, or <img>/link trigger a full database wipe with no credentials.
  app.post('/api/reset', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.SUPERADMIN) {
      return res.status(403).json({ error: 'Forbidden. Superadmin only.' });
    }
    await dbStore.reset();
    res.json({ success: true, message: 'Database reset to fresh seed data.' });
  });

  // ══════════════════════════════════════════
  // BULK DIAGNOSTIC GENERATION ENDPOINTS
  // ══════════════════════════════════════════

  interface BulkDiagnosticJob {
    jobId: string;
    classNumber: number;
    students: Array<{ name: string; studentId: string }>;
    totalSets: number;
    completed: number;
    status: 'running' | 'completed' | 'failed';
    fileName: string;
    filePath: string;
    pdfUrl: string;
    error: string;
    startedAt: string;
    completedAt: string;
  }

  const bulkJobs = new Map<string, BulkDiagnosticJob>();

  // Start a bulk diagnostic generation job
  app.post('/api/diagnostic/bulk', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { classNumber, count, students: reqStudents } = req.body;

    // Use provided students array or fall back to count
    let paperStudents: Array<{ name: string; studentId: string }>;
    let paperCount: number;

    if (Array.isArray(reqStudents) && reqStudents.length > 0) {
      paperStudents = reqStudents;
      paperCount = reqStudents.length;
    } else {
      paperCount = Number(count) || 0;
      if (paperCount <= 0) {
        return res.status(400).json({ error: 'count must be a positive number.' });
      }
      paperStudents = Array.from({ length: paperCount }, (_, i) => ({
        name: `Student ${i + 1}`,
        studentId: `PLACEHOLDER_${classNumber}_${i + 1}`
      }));
    }

    if (!classNumber) return res.status(400).json({ error: 'classNumber is required.' });

    // Role-based Authorization validation for bulk generation
    const classes = await dbStore.getClasses();
    let isAuthorized = false;

    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      isAuthorized = true;
    } else if (user.role === UserRole.TEACHER) {
      isAuthorized = classes.some(c => c.className === `Class ${classNumber}` && (c.teacherId === user.id || c.schoolId === user.schoolId));
    } else if (user.role === UserRole.VOLUNTEER) {
      isAuthorized = classes.some(c => c.className === `Class ${classNumber}` && user.assignedSchools?.includes(c.schoolId));
    } else if (user.role === UserRole.SCHOOL) {
      isAuthorized = classes.some(c => c.className === `Class ${classNumber}` && c.schoolId === user.schoolId);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      const schools = await dbStore.getSchools();
      const allowedSchools = schools.filter(s => s.blockCode === user.blockCode).map(s => s.id);
      isAuthorized = classes.some(c => c.className === `Class ${classNumber}` && allowedSchools.includes(c.schoolId));
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: `You are not authorized to generate diagnostic papers for Class ${classNumber}.` });
    }

    const jobId = 'bulk_' + randomUUID();
    const job: BulkDiagnosticJob = {
      jobId,
      classNumber: Number(classNumber),
      students: paperStudents,
      totalSets: paperCount,
      completed: 0,
      status: 'running',
      fileName: '',
      filePath: '',
      pdfUrl: '',
      error: '',
      startedAt: new Date().toISOString(),
      completedAt: ''
    };

    bulkJobs.set(jobId, job);

    // Run in background
    (async () => {
      try {
        const result = await generateDiagnosticPaper({
          classNumber: job.classNumber,
          students: paperStudents.map(s => ({ name: s.name, studentId: s.studentId })),
          onProgress: (setNum, total) => {
            job.completed = setNum;
          }
        });

        job.fileName = result.fileName;
        job.filePath = result.filePath;
        job.pdfUrl = `/output/${result.pdfFileName || result.fileName}`;
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.completed = job.totalSets;

        await dbStore.addLog({
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          schoolId: user.schoolId || '',
          schoolName: 'GPS',
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          activityType: 'download',
          status: 'Success',
          details: `Bulk diagnostic generated: Class ${classNumber}, ${paperCount} papers`
        });
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Unknown error during bulk generation';
        job.completedAt = new Date().toISOString();
        console.error('Bulk diagnostic job failed:', err);
      }
    })();

    res.status(202).json({
      jobId,
      classNumber: job.classNumber,
      totalStudents: paperCount,
      status: 'running',
      progressUrl: `/api/diagnostic/bulk/${jobId}/progress`
    });
  });

  // Poll bulk job progress
  app.get('/api/diagnostic/bulk/:jobId/progress', (req, res) => {
    const job = bulkJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    res.json({
      jobId: job.jobId,
      classNumber: job.classNumber,
      totalStudents: job.totalSets,
      completed: job.completed,
      status: job.status,
      pdfUrl: job.pdfUrl,
      error: job.error,
      downloadUrl: job.status === 'completed' ? `/api/diagnostic/bulk/${job.jobId}/download` : null
    });
  });

  // Download merged diagnostic PDF
  app.get('/api/diagnostic/bulk/:jobId/download', (req, res) => {
    const job = bulkJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job not yet completed.' });

    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: 'PDF file not found on disk.' });
    }

    res.download(job.filePath, `class${job.classNumber}_bulk_diagnostic.zip`);
  });

  // Generate diagnostic for a single student (enhanced with PDF download)
  app.post('/api/diagnostic/single', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, className } = req.body;
    if (!studentId || !className) {
      return res.status(400).json({ error: 'studentId and className are required.' });
    }

    try {
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      // Role-based Authorization validation for single generation
      let isAuthorized = false;
      if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
        isAuthorized = true;
      } else if (user.role === UserRole.TEACHER) {
        isAuthorized = student.teacherId === user.id || student.schoolId === user.schoolId;
      } else if (user.role === UserRole.VOLUNTEER) {
        isAuthorized = user.assignedSchools?.includes(student.schoolId) || false;
      } else if (user.role === UserRole.SCHOOL) {
        isAuthorized = student.schoolId === user.schoolId;
      } else if (user.role === UserRole.BLOCK_ADMIN) {
        const schools = await dbStore.getSchools();
        const school = schools.find(s => s.id === student.schoolId);
        isAuthorized = school?.blockCode === user.blockCode;
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: 'You are not authorized to generate diagnostic papers for this student.' });
      }

      // Parse class number from classGroup (e.g. "Class 2" -> 2)
      const classMatch = student.classGroup.match(/\d+/);
      const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

      let questions: Question[];
      let pdfUrl = '';
      let useMock = false;

      try {
        const result = await generateDiagnosticPaper({
          classNumber,
          students: [{
            name: student.name,
            studentId: student.id,
            qrData: {
              age: student.age, classGroup: student.classGroup, section: student.section,
              schoolId: student.schoolId, currentLevel: student.currentLevel,
              currentSubLevel: student.currentSubLevel, targetLevel: student.targetLevel,
              streak: student.streak
            }
          }]
        });
        questions = result.questions;
        pdfUrl = `/output/${result.fileName}`;
      } catch (err: any) {
        console.error("Puppeteer paper generation failed, using generateQuestionsForLevel mock:", err);
        useMock = true;
        // Generate questions across multiple levels using the level generator
        const startLevel = (classNumber - 1) * 12 + 1;
        questions = [];
        for (let lvl = startLevel; lvl < startLevel + 8; lvl++) {
          const lvlQuestions = generateQuestionsForLevel(Math.min(lvl, 59), 0);
          lvlQuestions.forEach(q => {
            questions.push({
              ...q,
              question_id: `DIAG_${lvl}_${q.question_id}`,
              source_level: Math.min(lvl, 59)
            });
          });
        }
        // Limit to 12 questions for a reasonable diagnostic
        questions = questions.slice(0, 12);
      }

      res.json({
        student,
        mockMode: useMock,
        diagnosticPaper: {
          id: 'diag_' + student.id + '_' + Date.now(),
          studentId: student.id,
          studentName: student.name,
          questions,
          pdfUrl
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate diagnostic.' });
    }
  });

  // --- Intervention Tracking & Best Practices Repository ---

  // Create a new intervention
  app.post('/api/interventions', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.TEACHER) {
      return res.status(403).json({ error: 'Only teachers can record interventions.' });
    }
    const { studentId, weakCompetencies, strategyType, strategyDescription, duration, startDate } = req.body;
    if (!studentId || !weakCompetencies?.length || !strategyType || !strategyDescription) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const intervention: Intervention = {
      id: 'int_' + randomUUID().slice(0, 8),
      studentId,
      studentName: student.name,
      teacherId: user.id,
      teacherName: user.name,
      schoolId: user.schoolId || student.schoolId,
      classId: student.classGroup,
      className: student.classGroup,
      section: student.section,
      weakCompetencies,
      currentLevel: student.currentLevel,
      strategyType,
      strategyDescription,
      duration: duration || '2 weeks',
      startDate: startDate || new Date().toISOString().split('T')[0],
      status: 'active',
      isPromoted: false,
      createdAt: new Date().toISOString()
    };
    await dbStore.addIntervention(intervention);
    await dbStore.addLog({
      id: 'log_' + randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      schoolId: user.schoolId || '',
      schoolName: '',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `INTERVENTION: Recorded remedial intervention for ${student.name} — Strategy: ${strategyType}`
    });
    res.json(intervention);
  });

  // List interventions (role-scoped)
  app.get('/api/interventions', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let interventions = await dbStore.getInterventions();

    if (user.role === UserRole.TEACHER) {
      interventions = interventions.filter(i => i.teacherId === user.id);
    } else if (user.role === UserRole.SCHOOL) {
      interventions = interventions.filter(i => i.schoolId === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      const assignedSchools = user.assignedSchools || [];
      interventions = interventions.filter(i => assignedSchools.includes(i.schoolId));
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      const schools = await dbStore.getSchools();
      const blockSchools = schools.filter(s => s.blockCode === user.blockCode).map(s => s.id);
      interventions = interventions.filter(i => blockSchools.includes(i.schoolId));
    }
    // District Admin, Admin, Superadmin see all
    res.json(interventions);
  });

  // Get single intervention
  app.get('/api/interventions/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const interventions = await dbStore.getInterventions();
    const intervention = interventions.find(i => i.id === req.params.id);
    if (!intervention) return res.status(404).json({ error: 'Intervention not found.' });
    res.json(intervention);
  });

  // Promote intervention to Best Practice (teacher only)
  app.post('/api/interventions/:id/promote', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.TEACHER) {
      return res.status(403).json({ error: 'Only teachers can promote interventions.' });
    }
    const interventions = await dbStore.getInterventions();
    const intervention = interventions.find(i => i.id === req.params.id);
    if (!intervention) return res.status(404).json({ error: 'Intervention not found.' });
    if (intervention.teacherId !== user.id) {
      return res.status(403).json({ error: 'You can only promote your own interventions.' });
    }
    if (!intervention.outcome?.improved) {
      return res.status(400).json({ error: 'Only interventions with confirmed improvement can be promoted.' });
    }
    if (intervention.isPromoted) {
      return res.status(400).json({ error: 'This intervention is already promoted.' });
    }

    const bp: BestPractice = {
      id: 'bp_' + randomUUID().slice(0, 8),
      interventionId: intervention.id,
      teacherId: intervention.teacherId,
      teacherName: intervention.teacherName,
      schoolId: intervention.schoolId,
      weakCompetencies: intervention.weakCompetencies,
      strategyType: intervention.strategyType,
      strategyDescription: intervention.strategyDescription,
      levelBefore: intervention.outcome.previousLevel,
      levelAfter: intervention.outcome.newLevel || intervention.outcome.previousLevel,
      levelJump: (intervention.outcome.newLevel || 0) - intervention.outcome.previousLevel,
      duration: intervention.duration,
      tags: [
        ...intervention.weakCompetencies,
        intervention.strategyType.replace('_', ' '),
        intervention.className
      ],
      viewCount: 0,
      createdAt: new Date().toISOString()
    };

    await dbStore.addBestPractice(bp);
    await dbStore.updateIntervention(intervention.id, { isPromoted: true, promotedAt: new Date().toISOString() });

    await dbStore.addLog({
      id: 'log_' + randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      schoolId: user.schoolId || '',
      schoolName: '',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `BEST PRACTICE: Teacher ${user.name} promoted intervention for ${intervention.studentName} to Best Practices Repository`
    });
    res.json(bp);
  });

  // Search/list Best Practices Repository (all roles)
  app.get('/api/best-practices', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let bestPractices = await dbStore.getBestPractices();
    const { search, competency, strategy, sort } = req.query;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      bestPractices = bestPractices.filter(bp =>
        bp.strategyDescription.toLowerCase().includes(q) ||
        bp.teacherName.toLowerCase().includes(q) ||
        bp.weakCompetencies.some(c => c.toLowerCase().includes(q)) ||
        bp.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (competency && typeof competency === 'string') {
      bestPractices = bestPractices.filter(bp => bp.weakCompetencies.includes(competency));
    }
    if (strategy && typeof strategy === 'string') {
      bestPractices = bestPractices.filter(bp => bp.strategyType === strategy);
    }
    if (sort === 'level_jump') {
      bestPractices.sort((a, b) => b.levelJump - a.levelJump);
    } else {
      bestPractices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.json(bestPractices);
  });

  // Get single Best Practice (increment view count)
  app.get('/api/best-practices/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const bestPractices = await dbStore.getBestPractices();
    const bp = bestPractices.find(b => b.id === req.params.id);
    if (!bp) return res.status(404).json({ error: 'Best practice not found.' });
    await dbStore.updateBestPractice(bp.id, { viewCount: (bp.viewCount || 0) + 1 });
    res.json({ ...bp, viewCount: (bp.viewCount || 0) + 1 });
  });



  // In development, serve the frontend using Vite development middleware.
  // In production, serve the built frontend bundle (frontend/dist).
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root: path.resolve(ROOT_DIR, '..', 'frontend'),
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      });
      app.use(vite.middlewares);
      console.log("[AI Studio] Vite development middleware mounted successfully");
    } catch (err) {
      console.warn("[AI Studio] Failed to load Vite dev middleware, falling back to static:", err);
    }
  } else {
    const distPath =
      process.env.FRONTEND_DIST_DIR ||
      path.resolve(ROOT_DIR, '..', 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
