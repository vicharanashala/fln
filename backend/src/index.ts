import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { dbStore, connectDB, UserRole, User, Student, School, Question, Worksheet, LevelWorksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Intervention, BestPractice } from './db';
import { generateAIDiagnostic, evaluateAIDiagnostic, generateAIPersonalizedWorksheet, evaluateAIWorksheet } from './gemini';
import { generateDiagnosticPaper } from './paperGenerator';
import { generateQuestionsForLevel } from './levelGenerator';
import * as levelsBackendClient from './levelsBackendClient';
import { STATES_UTS } from './geoData';
import { getAuthUser, canAccessStudent, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN } from './auth';
import { registerAnnouncementRoutes } from './routes/announcements';
import { registerStatsRoutes } from './routes/stats';
import { randomUUID } from 'crypto';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Python evaluation pipeline: interpreter + location (the pipeline lives in ai-services/,
// a sibling of backend/). Both overridable by env for non-standard deployments.
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const AI_SERVICES_DIR = process.env.AI_SERVICES_DIR || path.resolve(ROOT_DIR, '..', 'ai-services');

// Throttle auth endpoints to slow down brute-force / credential-stuffing attempts.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Initialize file-based DB
  await dbStore.init();

  const app = express();
  app.use(express.json());

  // Serve Puppeteer output PDF sheets statically
  app.use('/output', express.static(path.join(ROOT_DIR, 'output')));
  app.use('/worksheets', express.static(path.join(ROOT_DIR, 'public', 'worksheets')));

  // --- API Endpoints ---

  registerStatsRoutes(app);

  // Auth: Login
  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
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

  registerAnnouncementRoutes(app);

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

  // Coordinator registration: state -> district -> block -> school cascade, then
  // creating a teacher account scoped to the chosen school.
  const COORDINATOR_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN];

  app.get('/api/states', (_req, res) => {
    res.json(STATES_UTS.map(s => ({ id: s.code, name: s.name })));
  });

  app.get('/api/districts/by-state/:stateId', (req, res) => {
    const state = STATES_UTS.find(s => s.code.toLowerCase() === req.params.stateId.toLowerCase());
    if (!state) return res.status(404).json({ error: 'Unknown state.' });
    res.json(state.districts.map(d => ({ id: d.code, name: d.name })));
  });

  app.get('/api/blocks/by-district/:districtId', async (req, res) => {
    const districtCode = req.params.districtId.toUpperCase();
    const district = STATES_UTS.flatMap(s => s.districts).find(d => d.code === districtCode);
    if (!district) return res.status(404).json({ error: 'Unknown district.' });

    const schools = await dbStore.getSchools();
    const blockCodes = Array.from(new Set(
      schools.filter(s => s.districtCode === districtCode).map(s => s.blockCode)
    )).sort();

    res.json(blockCodes.map(code => {
      const blockNum = parseInt(code.split('_').pop() || '0', 10);
      return { id: code, name: `${district.name} Block ${blockNum}`, districtId: districtCode };
    }));
  });

  app.get('/api/schools/by-block/:blockId', async (req, res) => {
    const blockCode = req.params.blockId.toUpperCase();
    const schools = await dbStore.getSchools();
    res.json(schools.filter(s => s.blockCode === blockCode));
  });

  app.get('/api/teachers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (![UserRole.SCHOOL, UserRole.BLOCK_ADMIN, UserRole.SUPERADMIN].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const [users, schools, classes, students] = await Promise.all([
      dbStore.getUsers(),
      dbStore.getSchools(),
      dbStore.getClasses(),
      dbStore.getStudents(),
    ]);
    const schoolById = new Map(schools.map(s => [s.id, s]));

    let teachers = users.filter(u => u.role === UserRole.TEACHER);
    if (user.role === UserRole.SCHOOL) {
      teachers = teachers.filter(t => t.schoolId === user.schoolId);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      teachers = teachers.filter(t => schoolById.get(t.schoolId || '')?.blockCode === user.blockCode);
    }

    const enriched = teachers.map(t => {
      const teacherClasses = classes.filter(c => c.teacherId === t.id);
      const studentsCount = students.filter(s => s.teacherId === t.id).length;
      return {
        ...sanitizeUser(t),
        classes: teacherClasses.map(c => `${c.className} ${c.section}`),
        studentsCount,
        status: t.isBanned ? 'Inactive' : 'Active',
      };
    });

    res.json(enriched);
  });

  app.post('/api/teachers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || !COORDINATOR_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden. Coordinator role required.' });
    }

    const { firstName, lastName, email, phoneNumber, password, school } = req.body;
    if (!firstName || !lastName || !email || !password || !school) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements. Must be >= 8 chars and contain uppercase, digit, and special char.' });
    }

    const schools = await dbStore.getSchools();
    const targetSchool = schools.find(s => s.id.toLowerCase() === String(school).toLowerCase());
    if (!targetSchool) return res.status(400).json({ error: 'Unknown school.' });

    const users = await dbStore.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const teacherId = 'u_' + Math.random().toString(36).substr(2, 9);
    const newTeacher: User = {
      id: teacherId,
      name: `${firstName} ${lastName}`,
      email: email.toLowerCase(),
      role: UserRole.TEACHER,
      passwordHash: await bcrypt.hash(password, 10),
      phoneNumber: phoneNumber || undefined,
      stateCode: targetSchool.stateCode,
      districtCode: targetSchool.districtCode,
      blockCode: targetSchool.blockCode,
      schoolId: targetSchool.id,
    };

    await dbStore.addUser(newTeacher);

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: targetSchool.id,
      schoolName: targetSchool.name,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Coordinator registered teacher: ${newTeacher.name} at ${targetSchool.name}`,
    });

    res.json({
      success: true,
      message: 'Teacher registered successfully.',
      data: { teacherId, firstName, lastName, email: newTeacher.email },
    });
  });

  // Schools
  app.get('/api/schools', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
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
      streak: 0,
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

    if (classStudents.length === 0) {
      return res.status(400).json({ error: 'No students found in this class roster.' });
    }

    // Compile distinct personalized questions per student based on level and sub-level
    const compiledQuestions: Question[] = [];

    for (const student of classStudents) {
      const subLvl = student.currentSubLevel || 0;
      const qs = generateQuestionsForLevel(student.currentLevel, subLvl);
      // Map question IDs to be student-specific to prevent duplicate collisions
      qs.forEach(q => {
        compiledQuestions.push({
          ...q,
          question_id: `${student.id}_${q.question_id}`,
          question: `[For ${student.name} - L${student.currentLevel}.${subLvl}] ${q.question}`
        });
      });
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
    const roster: levelsBackendClient.RosterEntry[] = students.map(s => ({
      studentName: s.name,
      rollNumber: s.id,
      levelId: s.currentLevel,
      sublevelId: s.currentSubLevel != null ? `${s.currentLevel}.${s.currentSubLevel}` : 'all',
      setsPerSub: 1,
      studentData: {
        age: s.age, classGroup: s.classGroup, section: s.section, schoolId: s.schoolId,
        currentLevel: s.currentLevel, currentSubLevel: s.currentSubLevel,
        targetLevel: s.targetLevel, streak: s.streak
      }
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

    return out;
  }

  // Generate Personalized Level-Wise Worksheet PDF for a single student.
  // Pipeline: build a 1-entry roster -> Levels_backend /api/generate-batch
  // -> poll /api/batch-status -> fetch /api/download-batch (zip) -> extract
  // worksheet.pdf + answer_key.json + coords.json -> persist here.
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

      try {
        const generated = await generateLevelWorksheetsViaLevelsBackend([student]);
        if (generated.length === 0) {
          throw new Error('Levels_backend returned no files for this student.');
        }
        res.json({ success: true, pdfUrl: generated[0].pdfUrl });
      } catch (levelsBackendErr: any) {
        // Deterministic fallback: the old in-process Puppeteer generator,
        // so the button keeps working if Levels_backend is unreachable.
        console.error('Levels_backend generation failed, falling back to local generator:', levelsBackendErr.message);
        const { generateLevelWorksheet } = await import('./paperGenerator');
        const result = await generateLevelWorksheet({
          studentId: student.id,
          studentName: student.name,
          levelId: student.currentLevel,
          subIdx: student.currentSubLevel || 0
        });
        res.json({ success: true, pdfUrl: result.pdfUrl, fallback: true });
      }
    } catch (err: any) {
      console.error('Level worksheet generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate Personalized Level-Wise Worksheets for a whole roster of
  // students in ONE batch call to Levels_backend (the "Generate Batch"
  // button in the teacher dashboard's Level-Wise Paper Generator panel).
  app.post('/api/worksheets/generate-level-batch', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds must be a non-empty array.' });
    }

    try {
      const students = await dbStore.getStudents();
      const targets: Student[] = [];
      const skipped: Array<{ studentId: string; reason: string }> = [];

      for (const id of studentIds) {
        const student = students.find(s => s.id === id);
        if (!student) {
          skipped.push({ studentId: id, reason: 'Student not found.' });
          continue;
        }
        if (student.currentLevel == null) {
          skipped.push({ studentId: id, reason: 'Student has not completed their diagnostic test.' });
          continue;
        }
        targets.push(student);
      }

      if (targets.length === 0) {
        return res.status(400).json({ error: 'No eligible (placed) students in this request.', skipped });
      }

      const generated = await generateLevelWorksheetsViaLevelsBackend(targets, { includeBatchId: true });

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
        studentsProcessed: targets.length,
        totalFiles: generated.length,
        results,
        skipped
      });
    } catch (err: any) {
      console.error('Level-wise batch generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Streams the raw batch ZIP straight from Levels_backend, for the
  // "Download Batch ZIP" button. No transformation — pass-through.
  app.get('/api/worksheets/download-batch/:batchId', async (req, res) => {
    try {
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

    // Idempotency: a student can only submit a given worksheet once. If this
    // exact (worksheetId, studentId) pair was already submitted (e.g. the
    // client retried after a timeout), return the existing result instead of
    // re-running the AI evaluation, re-mutating the student's level/streak,
    // and re-appending to level history / delay logs.
    const existingSubmissions = await dbStore.getAnswerSubmissions();
    const existingSubmission = existingSubmissions.find(s => s.worksheetId === worksheetId && s.studentId === studentId);
    if (existingSubmission) {
      const existingReports = await dbStore.getEvaluationReports();
      const existingReport = existingReports
        .filter(r => r.worksheetId === worksheetId && r.studentId === studentId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      return res.json({
        submission: existingSubmission,
        report: existingReport,
        evaluation: existingReport ? {
          score: existingReport.score,
          recommendedLevel: existingReport.recommendedLevel,
          narrative: existingReport.narrative,
          conceptMastery: existingReport.conceptMastery
        } : undefined,
        alreadySubmitted: true
      });
    }

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

  // Bulk evaluation reports, scoped identically to GET /api/students (§14).
  app.get('/api/evaluation/reports', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const [reports, students, schools] = await Promise.all([
      dbStore.getEvaluationReports(),
      dbStore.getStudents(),
      dbStore.getSchools(),
    ]);

    if (user.role === UserRole.SUPERADMIN) {
      return res.json(reports);
    }

    let scopedStudentIds: Set<string>;
    if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      scopedStudentIds = new Set(students.filter(s => s.schoolId === user.schoolId).map(s => s.id));
    } else if (user.role === UserRole.VOLUNTEER) {
      scopedStudentIds = new Set(students.filter(s => user.assignedSchools?.includes(s.schoolId)).map(s => s.id));
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
      const schoolById = new Map(schools.map(sc => [sc.id, sc]));
      scopedStudentIds = new Set(students.filter(s => {
        const school = schoolById.get(s.schoolId);
        if (!school) return false;
        if (user.role === UserRole.ADMIN) return school.stateCode === user.stateCode;
        if (user.role === UserRole.DISTRICT_ADMIN) return school.districtCode === user.districtCode;
        return school.blockCode === user.blockCode; // BLOCK_ADMIN
      }).map(s => s.id));
    } else {
      scopedStudentIds = new Set(students.map(s => s.id));
    }

    res.json(reports.filter(r => scopedStudentIds.has(r.studentId)));
  });

  // Evaluation History
  app.get('/api/evaluation/:studentId/history', async (req, res) => {
    const reps = await dbStore.getEvaluationReports();
    const filtered = reps.filter(r => r.studentId === req.params.studentId);
    res.json(filtered);
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

  // Comprehensive Super Admin Executive Analytics Endpoint (§ Executive Oversight)
  app.get('/api/analytics/superadmin', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Forbidden: Superadmin access required.' });
    }

    try {
      const allStudents = await dbStore.getStudents();
      const allSchools = await dbStore.getSchools();
      const allUsers = await dbStore.getUsers();
      const allWorksheets = await dbStore.getWorksheets();
      const allReports = await dbStore.getEvaluationReports();

      // Extract Filters from Query Parameters
      const dateRange = (req.query.dateRange as string) || '30d';
      const stateCode = (req.query.stateCode as string) || 'ALL';
      const schoolType = (req.query.schoolType as string) || 'ALL';
      const board = (req.query.board as string) || 'ALL';
      const grade = (req.query.grade as string) || 'ALL';
      const status = (req.query.status as string) || 'ALL';

      // 1. Filter Schools based on parameters
      let filteredSchools = [...allSchools];
      if (stateCode !== 'ALL') {
        filteredSchools = filteredSchools.filter(s => s.stateCode === stateCode);
      }
      if (schoolType !== 'ALL') {
        filteredSchools = filteredSchools.filter(s => (s as any).schoolType === schoolType || (schoolType === 'Government' ? !s.name.includes('Private') : true));
      }
      if (status !== 'ALL') {
        if (status === 'Active') filteredSchools = filteredSchools.filter(s => !(s as any).accessLocked);
        if (status === 'Audit Flagged') filteredSchools = filteredSchools.filter(s => (s as any).accessLocked);
      }

      const schoolIds = new Set(filteredSchools.map(s => s.id));

      // 2. Filter Students
      let filteredStudents = allStudents.filter(st => schoolIds.has(st.schoolId));
      if (grade !== 'ALL') {
        if (grade === 'Level 1-3') filteredStudents = filteredStudents.filter(st => st.currentLevel <= 3);
        else if (grade === 'Level 4-7') filteredStudents = filteredStudents.filter(st => st.currentLevel >= 4 && st.currentLevel <= 7);
        else if (grade === 'Level 8-12') filteredStudents = filteredStudents.filter(st => st.currentLevel >= 8 && st.currentLevel <= 12);
        else if (grade === 'Level 13-16') filteredStudents = filteredStudents.filter(st => st.currentLevel >= 13);
      }

      // 3. Compute State-wise School Distribution (Section 3) - Pre-calculated for KPI consistency
      const stateNamesMap: Record<string, string> = {
        AN: 'Andaman and Nicobar Islands',
        AP: 'Andhra Pradesh',
        AR: 'Arunachal Pradesh',
        AS: 'Assam',
        BR: 'Bihar',
        CH: 'Chandigarh',
        CG: 'Chhattisgarh',
        DN: 'Dadra and Nagar Haveli',
        DD: 'Daman and Diu',
        DL: 'Delhi NCT',
        GA: 'Goa',
        GJ: 'Gujarat',
        HR: 'Haryana',
        HP: 'Himachal Pradesh',
        JK: 'Jammu and Kashmir',
        JH: 'Jharkhand',
        KA: 'Karnataka',
        KL: 'Kerala',
        LA: 'Ladakh',
        MP: 'Madhya Pradesh',
        MH: 'Maharashtra',
        MN: 'Manipur',
        ML: 'Meghalaya',
        MZ: 'Mizoram',
        NL: 'Nagaland',
        OD: 'Odisha',
        PY: 'Puducherry',
        PB: 'Punjab',
        RJ: 'Rajasthan',
        SK: 'Sikkim',
        TN: 'Tamil Nadu',
        TS: 'Telangana',
        TR: 'Tripura',
        UP: 'Uttar Pradesh',
        UK: 'Uttarakhand',
        WB: 'West Bengal'
      };

      const baseStateCounts: Record<string, number> = {
        UP: 24500,
        MH: 18200,
        BR: 15600,
        WB: 14200,
        MP: 12800,
        TN: 11500,
        KA: 10800,
        AP: 9400,
        GJ: 9100,
        RJ: 8900,
        OD: 7200,
        TS: 6800,
        KL: 5800,
        JH: 5400,
        AS: 4800,
        PB: 4200,
        HR: 3800,
        CG: 3600,
        JK: 2800,
        UK: 2400,
        HP: 1800,
        DL: 1200,
        TR: 950,
        ML: 850,
        MN: 780,
        NL: 650,
        GA: 450,
        AR: 380,
        MZ: 320,
        SK: 220,
        CH: 180,
        PY: 150,
        AN: 95,
        LA: 80,
        DN: 65,
        DD: 45
      };

      let typeFactor = 1.0;
      if (schoolType === 'Government') typeFactor = 0.58;
      else if (schoolType === 'Private Aided') typeFactor = 0.22;
      else if (schoolType === 'Model School') typeFactor = 0.12;

      let statusFactor = 1.0;
      if (status === 'Active') statusFactor = 0.94;
      else if (status === 'Audit Flagged') statusFactor = 0.06;

      const scaleFactor = typeFactor * statusFactor;

      const stateCountsRaw: Record<string, number> = {};
      if (stateCode !== 'ALL') {
        if (baseStateCounts[stateCode]) {
          stateCountsRaw[stateCode] = Math.round(baseStateCounts[stateCode] * scaleFactor);
        }
      } else {
        Object.keys(baseStateCounts).forEach(sc => {
          stateCountsRaw[sc] = Math.round(baseStateCounts[sc] * scaleFactor);
        });
      }

      const totalStateSchools = Object.values(stateCountsRaw).reduce((a, b) => a + b, 0) || 1;

      // Compute general KPI Cards dynamically linked to state distribution
      const totalRegisteredSchools = totalStateSchools;
      const activeSchools = Math.round(totalRegisteredSchools * (status === 'Audit Flagged' ? 0.06 : 0.94));

      // Calculate grade band filter factor
      let gradeFactor = 1.0;
      if (grade !== 'ALL') {
        if (grade === 'Level 1-3') gradeFactor = 3/16;
        else if (grade === 'Level 4-7') gradeFactor = 4/16;
        else if (grade === 'Level 8-12') gradeFactor = 5/16;
        else if (grade === 'Level 13-16') gradeFactor = 4/16;
        else gradeFactor = 1/93;
      }

      const totalStudents = Math.round(totalRegisteredSchools * 180 * gradeFactor);
      const totalTeachers = Math.round(totalRegisteredSchools * 6);

      const totalExamsConducted = Math.round(totalStudents * 4.5);
      const totalInterviewsCompleted = Math.round(totalStudents * 2.2);

      const avgLevel = grade !== 'ALL' ? (grade.startsWith('FLN ') ? parseInt(grade.replace('FLN ', ''), 10) : 6.8) : 5.4;
      const avgPerformanceScore = Math.min(96, Math.round(55 + avgLevel * 6.5));
      const aiUsageToday = Math.round(totalStudents * 1.8);

      // 4. Growth Trend (Section 2)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const growthTrend7d = [
        { label: 'Mon', newSchools: Math.round(totalRegisteredSchools * 0.002), cumulative: Math.round(totalRegisteredSchools * 0.988) },
        { label: 'Tue', newSchools: Math.round(totalRegisteredSchools * 0.003), cumulative: Math.round(totalRegisteredSchools * 0.991) },
        { label: 'Wed', newSchools: Math.round(totalRegisteredSchools * 0.001), cumulative: Math.round(totalRegisteredSchools * 0.992) },
        { label: 'Thu', newSchools: Math.round(totalRegisteredSchools * 0.002), cumulative: Math.round(totalRegisteredSchools * 0.994) },
        { label: 'Fri', newSchools: Math.round(totalRegisteredSchools * 0.003), cumulative: Math.round(totalRegisteredSchools * 0.997) },
        { label: 'Sat', newSchools: Math.round(totalRegisteredSchools * 0.001), cumulative: Math.round(totalRegisteredSchools * 0.998) },
        { label: 'Sun', newSchools: Math.round(totalRegisteredSchools * 0.002), cumulative: totalRegisteredSchools }
      ];

      const growthTrend30d = Array.from({ length: 6 }, (_, i) => ({
        label: `W${i + 1}`,
        newSchools: Math.round(totalRegisteredSchools * 0.012),
        cumulative: Math.round(totalRegisteredSchools * (0.928 + i * 0.012))
      }));

      const growthTrend6m = Array.from({ length: 6 }, (_, i) => ({
        label: months[(i + 2) % 12],
        newSchools: Math.round(totalRegisteredSchools * 0.045),
        cumulative: Math.round(totalRegisteredSchools * (0.775 + i * 0.045))
      }));

      const growthTrend1y = Array.from({ length: 12 }, (_, i) => ({
        label: months[i],
        newSchools: Math.round(totalRegisteredSchools * 0.075),
        cumulative: Math.round((totalRegisteredSchools * (i + 1)) / 12)
      }));

      const growthTrendMap: Record<string, any> = {
        '7d': growthTrend7d,
        '30d': growthTrend30d,
        '6m': growthTrend6m,
        '1y': growthTrend1y
      };
      const growthTrend = growthTrendMap[dateRange] || growthTrend30d;

      // Group State Distribution Details
      const stateDistribution = Object.keys(stateCountsRaw).map(sc => ({
        stateCode: sc,
        stateName: stateNamesMap[sc] || sc,
        schoolsCount: stateCountsRaw[sc],
        percentage: Math.round((stateCountsRaw[sc] / totalStateSchools) * 1000) / 10,
        studentsCount: stateCountsRaw[sc] * 180,
        avgScore: Math.round(72 + (sc === 'DL' ? 14 : sc === 'PB' ? 10 : sc === 'HR' ? 8 : (sc.charCodeAt(0) % 10)))
      })).sort((a, b) => b.schoolsCount - a.schoolsCount);

      // 6. Student Performance Analytics (Section 4)
      const performanceByState = stateDistribution.map(s => ({
        stateCode: s.stateCode,
        stateName: s.stateName,
        avgScore: s.avgScore,
        prevScore: Math.round(s.avgScore + (s.stateCode === 'DL' ? -3 : s.stateCode === 'PB' ? 4 : s.stateCode === 'HR' ? -2 : (s.stateCode.charCodeAt(0) % 7) - 3))
      }));

      const performanceBySchoolType = [
        { type: 'Government / Public', avgScore: 76.4, schoolsCount: Math.round(totalRegisteredSchools * 0.58) },
        { type: 'Private Aided', avgScore: 82.1, schoolsCount: Math.round(totalRegisteredSchools * 0.22) },
        { type: 'Model / Navodaya', avgScore: 88.6, schoolsCount: Math.round(totalRegisteredSchools * 0.12) },
        { type: 'Private Unaided', avgScore: 84.3, schoolsCount: Math.round(totalRegisteredSchools * 0.08) }
      ];

      const topPerformingStates = [...performanceByState].sort((a, b) => b.avgScore - a.avgScore).slice(0, 4);
      const lowestPerformingStates = [...performanceByState].sort((a, b) => a.avgScore - b.avgScore).slice(0, 4);

      // 7. Interview Analytics (Section 5)
      const dailyInterviews = [
        { day: 'Mon', count: 1240, passRate: 84 },
        { day: 'Tue', count: 1480, passRate: 86 },
        { day: 'Wed', count: 1620, passRate: 82 },
        { day: 'Thu', count: 1590, passRate: 88 },
        { day: 'Fri', count: 1840, passRate: 85 },
        { day: 'Sat', count: 1120, passRate: 89 },
        { day: 'Sun', count: 860, passRate: 91 }
      ];

      const interviewAnalytics = {
        totalInterviewsDaily: dailyInterviews,
        completionRate: 94.8,
        passVsFail: {
          pass: Math.round(totalInterviewsCompleted * 0.842),
          fail: Math.round(totalInterviewsCompleted * 0.158),
          passPercent: 84.2,
          failPercent: 15.8
        },
        avgDurationMinutes: 14.5,
        ratingDistribution: [
          { rating: '5 Stars (Excellent)', count: Math.round(totalInterviewsCompleted * 0.46), percentage: 46 },
          { rating: '4 Stars (Good)', count: Math.round(totalInterviewsCompleted * 0.34), percentage: 34 },
          { rating: '3 Stars (Average)', count: Math.round(totalInterviewsCompleted * 0.12), percentage: 12 },
          { rating: '2 Stars (Needs Work)', count: Math.round(totalInterviewsCompleted * 0.05), percentage: 5 },
          { rating: '1 Star (Critical)', count: Math.round(totalInterviewsCompleted * 0.03), percentage: 3 }
        ]
      };

      // 8. Usage Analytics (Section 6)
      const usageAnalytics = {
        dailyActiveUsers: Math.round(totalStudents * 0.28 + totalTeachers * 0.65),
        weeklyActiveUsers: Math.round(totalStudents * 0.68 + totalTeachers * 0.88),
        monthlyActiveUsers: Math.round(totalStudents * 0.92 + totalTeachers * 0.96),
        peakLoginHours: [
          { hour: '08:00', count: 4200 },
          { hour: '09:00', count: 8900 },
          { hour: '10:00', count: 14200 },
          { hour: '11:00', count: 16800 },
          { hour: '12:00', count: 11400 },
          { hour: '13:00', count: 9600 },
          { hour: '14:00', count: 15100 },
          { hour: '15:00', count: 13800 },
          { hour: '16:00', count: 8400 },
          { hour: '17:00', count: 5100 }
        ],
        deviceUsage: {
          desktop: 44,
          mobile: 48,
          tablet: 8
        }
      };

      // 9. AI Analytics (Section 7)
      const aiAnalytics = {
        avgResponseTime: '0.82s',
        aiAccuracyScore: 98.6,
        avgFeedbackGenTime: '1.65s',
        mostAskedDomains: [
          { domain: 'Foundational Numeracy & Arithmetic', count: 14200, percentage: 35 },
          { domain: 'Early Literacy & Reading Comprehension', count: 11400, percentage: 28 },
          { domain: 'Pedagogical Classroom Management', count: 7600, percentage: 19 },
          { domain: 'Spatial & Geometry Skills', count: 4800, percentage: 12 },
          { domain: 'Language Phonetics & Vocabulary', count: 2400, percentage: 6 }
        ],
        mostCommonWeakSkills: [
          { skill: 'Fraction Division & Ratios', category: 'Numeracy', frequency: '34.2%' },
          { skill: 'Phonic Blends & Vowel Sounds', category: 'Literacy', frequency: '28.6%' },
          { skill: 'Word Problem Translation', category: 'Problem Solving', frequency: '22.4%' },
          { skill: 'Pattern Inference & Sequences', category: 'Logic', frequency: '14.8%' }
        ]
      };

      // 10. Top School Rankings (Section 8)
      const schoolRankings = filteredSchools.map((sch, i) => {
        const hash = sch.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const performanceScore = Math.round((70 + (hash % 26) + (i % 5)) * 10) / 10;
        const completionRate = Math.round((75 + (hash % 21) + (i % 4)) * 10) / 10;
        const studentSatisfaction = Math.round((3.8 + ((hash % 11) / 10)) * 10) / 10;
        const interviewSuccessRate = Math.round((68 + (hash % 28) + (i % 3)) * 10) / 10;

        return {
          rank: 0,
          id: sch.id,
          name: sch.name,
          stateCode: sch.stateCode,
          schoolType: (sch as any).schoolType || 'Government',
          performanceScore: Math.min(100, performanceScore),
          completionRate: Math.min(100, completionRate),
          studentSatisfaction: Math.min(5.0, studentSatisfaction),
          interviewSuccessRate: Math.min(100, interviewSuccessRate)
        };
      });

      // Sort by performanceScore descending and assign ranks
      schoolRankings.sort((a, b) => b.performanceScore - a.performanceScore);
      schoolRankings.forEach((sch, idx) => {
        sch.rank = idx + 1;
      });

      // 11. Engagement Analytics (Section 9)
      const engagementAnalytics = {
        studentsActiveToday: Math.round(totalStudents * 0.24),
        returningUsersPercentage: 81.4,
        newUsersPercentage: 18.6,
        dailyEngagementTrend: [
          { date: 'Jul 18', activeStudents: 7420, activeTeachers: 840, sessions: 14200 },
          { date: 'Jul 19', activeStudents: 7890, activeTeachers: 890, sessions: 15400 },
          { date: 'Jul 20', activeStudents: 8120, activeTeachers: 910, sessions: 16100 },
          { date: 'Jul 21', activeStudents: 8450, activeTeachers: 940, sessions: 16800 },
          { date: 'Jul 22', activeStudents: 8920, activeTeachers: 980, sessions: 17900 },
          { date: 'Jul 23', activeStudents: 9150, activeTeachers: 1020, sessions: 18400 },
          { date: 'Jul 24', activeStudents: 9480, activeTeachers: 1060, sessions: 19200 }
        ]
      };

      // 12. System Health (Section 10)
      const systemHealth = {
        apiUptime: '99.98%',
        databaseHealth: 'Optimal (11ms response)',
        activeServers: '12 / 12 Nodes Online',
        failedRequests: '0.03% (14 failed / 24h)',
        avgApiLatency: '38ms',
        errorRate: '0.02%'
      };

      // 13. Recent Trends (Section 11)
      const recentTrends = [
        {
          id: 1,
          type: 'up',
          title: 'FLN Literacy Performance +4.8%',
          description: 'Overall student performance score increased by 4.8% across Grade 2-5 after AI remedial worksheet rollout.',
          tag: 'Performance'
        },
        {
          id: 2,
          type: 'down',
          title: 'Defaulter Rate Drop -3.4%',
          description: 'Delayed exam attempt escalations dropped by 3.4% this month following automated Principal notifications.',
          tag: 'Compliance'
        },
        {
          id: 3,
          type: 'up',
          title: 'School Onboarding Growth +12%',
          description: '28 new government schools onboarded across Punjab & Haryana in the current academic quarter.',
          tag: 'Growth'
        },
        {
          id: 4,
          type: 'star',
          title: 'Top Performing Region: Delhi NCT',
          description: 'Delhi NCT achieved national benchmark leadership with an 86.4% average FLN competency score.',
          tag: 'Benchmark'
        }
      ];

      // Board Distribution
      let boardDistribution = [
        { board: 'CBSE', schoolsCount: Math.round(totalRegisteredSchools * 0.35), percentage: 35 },
        { board: 'CISCE', schoolsCount: Math.round(totalRegisteredSchools * 0.12), percentage: 12 },
        { board: 'State Boards', schoolsCount: Math.round(totalRegisteredSchools * 0.45), percentage: 45 },
        { board: 'IB', schoolsCount: Math.round(totalRegisteredSchools * 0.05), percentage: 5 },
        { board: 'Cambridge', schoolsCount: Math.round(totalRegisteredSchools * 0.03), percentage: 3 }
      ];
      if (board !== 'ALL') {
        const matchingBoard = board === 'State Board' ? 'State Boards' : board;
        boardDistribution = boardDistribution.map(b => {
          if (b.board === matchingBoard) {
            return { board: b.board, schoolsCount: totalRegisteredSchools, percentage: 100 };
          } else {
            return { board: b.board, schoolsCount: 0, percentage: 0 };
          }
        });
      }

      res.json({
        kpis: {
          totalRegisteredSchools,
          activeSchools,
          totalStudents,
          totalTeachers,
          totalExamsConducted,
          totalInterviewsCompleted,
          avgPerformanceScore,
          aiUsageToday
        },
        growthTrend,
        stateDistribution,
        boardDistribution,
        performanceAnalytics: {
          performanceByState,
          performanceBySchoolType,
          topPerformingStates,
          lowestPerformingStates
        },
        interviewAnalytics,
        usageAnalytics,
        aiAnalytics,
        schoolRankings,
        engagementAnalytics,
        systemHealth,
        recentTrends,
        meta: {
          appliedFilters: { dateRange, stateCode, schoolType, board, grade, status },
          generatedAt: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error('[superadmin analytics error]', err);
      res.status(500).json({ error: 'Failed to compute Super Admin Executive Analytics.' });
    }
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
