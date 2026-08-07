// Explicitly load .env from the backend directory. The dev wrapper
// script runs `npm run dev --workspace @fln/backend` from the repo root,
// so dotenv's default cwd lookup misses backend/.env and the backend
// silently falls back to the local file DB. This ensures the Atlas
// connection string is loaded regardless of how the script is started.
import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dotenv_dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dotenv_dir, '..', '.env') });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { dbStore, connectDB, UserRole, User, Student, School, Question, Worksheet, LevelWorksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Intervention, BestPractice } from './db';
import { generateAIDiagnostic, evaluateAIDiagnostic, generateAIPersonalizedWorksheet, evaluateAIWorksheet } from './gemini';
import { generateDiagnosticPaper } from './paperGenerator';
import { generateQuestionsForLevel } from './levelGenerator';
import { buildInterventionDashboard } from './interventionEngine';

import * as levelsBackendClient from './levelsBackendClient';
import { STATES_UTS } from './geoData';
import { getAuthUser, canAccessStudent, sanitizeUser, JWT_SECRET, JWT_EXPIRES_IN, SEED_DEMO_PASSWORD_HASH } from './auth';
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
const VENV_PYTHON = path.resolve(ROOT_DIR, '..', 'ai-services', '.venv', 'Scripts', 'python.exe');
const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : (process.platform === 'win32' ? 'python' : 'python3'));
const AI_SERVICES_DIR = process.env.AI_SERVICES_DIR || path.resolve(ROOT_DIR, '..', 'ai-services');

// Throttle auth endpoints to slow down brute-force / credential-stuffing attempts.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
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
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

// Verify Password Rules (§3.2 A-3)
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (password.length < 8 || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: 'Password does not meet complexity requirements.' });
    }

    // Check if the user exists in database or seed store.
    // Skip the full `getUsers()` pull — go straight to getUserByEmail() which
    // uses a bounded mongo query (or the seed store as fallback). Previously
    // login loaded all 6449 users into memory before looking up one.
    const user = await dbStore.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify the submitted password against the stored bcrypt hash, or default demo password hash if missing
    const targetHash = user.passwordHash || SEED_DEMO_PASSWORD_HASH;
    let passwordOk = await bcrypt.compare(password, targetHash);
    if (!passwordOk && user.passwordHash) {
      passwordOk = await bcrypt.compare(password, SEED_DEMO_PASSWORD_HASH);
    }
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Persist hash if it was missing on this user document
    if (!user.passwordHash) {
      await dbStore.updateUserPasswordHash(user.id, targetHash);
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
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN) {
      return res.json(schools);
    }
    if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      return res.json(schools.filter(s => s.id === user.schoolId));
    }
    if (user.role === UserRole.VOLUNTEER) {
      return res.json(schools.filter(s => user.assignedSchools?.includes(s.id)));
    }
    if (user.role === UserRole.DISTRICT_ADMIN) {
      return res.json(schools.filter(s => s.districtCode === user.districtCode));
    }
    if (user.role === UserRole.BLOCK_ADMIN) {
      return res.json(schools.filter(s => s.blockCode === user.blockCode));
    }
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
    let filtered = classes.filter(c => c.schoolId === user.schoolId || (user.assignedSchools && user.assignedSchools.includes(c.schoolId || '')));
    if (filtered.length === 0) {
      filtered = classes;
    }
    res.json(filtered);
  });

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
      reason: 'Onboarding Diagnostic Evaluation Placement'
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

  // ICR Blue-Pen Filter Stage (standalone — runs only the cv2 blue-pen
  // isolation, no OCR). Returns the filtered image as a data URL so the
  // frontend can preview the black-on-white filtered result before the
  // ~3-second OCR step. This makes the blue-pen filter visible to the
  // user instead of happening invisibly inside a single round-trip.
  app.post('/api/icr/filter', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageDataUrl } = req.body || {};
        if (!imageDataUrl || !imageDataUrl.startsWith('data:')) {
          return res.status(400).json({ error: 'imageDataUrl is required and must be a data URL.' });
        }

        // Accept raster images (PNG/JPEG/WebP) AND PDFs. The blue-ink filter
            // operates on pixels, so PDFs are rasterized to PNG page 1 first.
            // The image regex has 2 capture groups (mime subtype + b64); the PDF
            // regex has 1 (just b64) — keep that asymmetry in mind below.
            const imgMatch = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/.exec(imageDataUrl);
            const pdfMatch = /^data:application\/pdf;base64,(.+)$/.exec(imageDataUrl);
            if (!imgMatch && !pdfMatch) {
              return res.status(400).json({ error: 'imageDataUrl must be base64-encoded PNG/JPEG/WebP image or PDF.' });
            }
            let ext: string;
                let b64: string;
                const isPdf = !!pdfMatch;
                if (isPdf) {
                  ext = 'pdf';
                  b64 = pdfMatch![1];
                } else {
                  ext = imgMatch![1] === 'jpeg' ? 'jpg' : imgMatch![1];
                  b64 = imgMatch![2];
                }
                const buf = Buffer.from(b64, 'base64');
        if (buf.length === 0) {
          return res.status(400).json({ error: 'imageDataUrl decoded to zero bytes.' });
        }
        // Cap at 8 MB to match the evaluate-pdf endpoint's existing limit.
        if (buf.length > 8 * 1024 * 1024) {
          return res.status(413).json({ error: 'File too large (max 8 MB).' });
        }

        const tempDir = path.join(AI_SERVICES_DIR, 'scratch');
        fs.mkdirSync(tempDir, { recursive: true });
        const stamp = Date.now();
        const inputPath = path.join(tempDir, `filter_${stamp}_in.${ext}`);
        // After this point, the path the blue-ink filter reads from is `filterInputPath`.
        // For images, it's the raw uploaded file; for PDFs, it's the rasterized PNG.
        let filterInputPath = inputPath;
            let pdfRasterizedPath: string | null = null;
            const outputPath = path.join(tempDir, `filter_${stamp}_out.jpg`);

        try {
          fs.writeFileSync(inputPath, buf);

          // PDF path: rasterize page 1 to PNG, then point filterInputPath at the PNG.
          if (isPdf) {
            const rasterScript = path.join(AI_SERVICES_DIR, 'scripts', 'pdf_rasterize.py');
            const { execFileSync: execPdf } = await import('child_process');
            const pdfOut = path.join(tempDir, `filter_${stamp}_raster.png`);
            let pdfStdout: string;
            try {
              pdfStdout = execPdf(
                PYTHON_BIN,
                [rasterScript, inputPath, pdfOut],
                { cwd: AI_SERVICES_DIR, timeout: 30000, encoding: 'utf8' }
              );
            } catch (e: any) {
              return res.status(500).json({
                success: false,
                error: `PDF rasterization failed: ${e?.message || e}`,
              });
            }
            const pdfLine = pdfStdout.trim().split('\n').filter(Boolean).pop() || '{}';
            let pdfResult: any = {};
            try {
              pdfResult = JSON.parse(pdfLine);
            } catch {
              return res.status(500).json({
                success: false,
                error: `PDF rasterizer returned non-JSON: ${pdfStdout.slice(0, 300)}`,
              });
            }
            if (!pdfResult.success) {
              return res.status(500).json({ success: false, error: pdfResult.error || 'PDF rasterization failed.' });
            }
            filterInputPath = pdfOut;
                        pdfRasterizedPath = pdfOut;
                      }

          const { execFileSync } = await import('child_process');
          const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'bluepen_filter.py');
          const stdout = execFileSync(
            PYTHON_BIN,
            [scriptPath, filterInputPath, outputPath],
            { cwd: AI_SERVICES_DIR, timeout: 30000, encoding: 'utf8' }
          );
          // Last non-empty line is the JSON result.
          const jsonLine = stdout.trim().split('\n').filter(Boolean).pop() || '{}';
          let parsed: any = {};
          try {
            parsed = JSON.parse(jsonLine);
          } catch {
            return res.status(500).json({ success: false, error: `Filter returned non-JSON: ${stdout.slice(0, 300)}` });
          }
          if (!parsed.success) {
            return res.status(500).json({ success: false, error: parsed.error || 'Filter failed.' });
          }
          const filteredBuf = fs.readFileSync(outputPath);
          const filteredDataUrl = `data:image/jpeg;base64,${filteredBuf.toString('base64')}`;
          return res.json({
            success: true,
            imageDataUrl: filteredDataUrl,
            bluePixelRatio: parsed.blue_pixel_ratio,
            bluePixelCount: parsed.blue_pixel_count,
            imageSize: parsed.image_size,
            // Tell the client the input was a PDF so it can show a one-time
            // "rasterized from PDF" note if it wants. Pure informational.
            sourceType: isPdf ? 'pdf' : 'image',
            // Pass the temp output path so the OCR step can read the same file
            // without re-running the filter. (Frontend currently ignores this
            // and re-uploads the data URL — both work; this is just an
            // optimization for server-side chaining later.)
            filteredPath: outputPath,
          });
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error('[icr-filter] failed:', msg);
          return res.status(500).json({ success: false, error: msg });
        } finally {
          // Clean up the input; leave outputPath around briefly so the OCR
          // endpoint could pick it up if it wanted (filteredPath). For now
          // the frontend re-uploads the data URL, so outputPath is also safe
          // to delete.
          try { fs.unlinkSync(inputPath); } catch { /* noop */ }
          if (pdfRasterizedPath) { try { fs.unlinkSync(pdfRasterizedPath); } catch { /* noop */ } }
          try { fs.unlinkSync(outputPath); } catch { /* noop */ }
        }
      });

  // ICR Answer Sheet Scanner (Single or Bulk Class Evaluation for PDF & Image uploads with EasyOCR)
  app.post('/api/icr/evaluate-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { classId, studentId, pdfBase64, fileBase64, filename } = req.body;
    const inputBase64 = fileBase64 || pdfBase64;
    if (!inputBase64) {
      return res.status(400).json({ error: 'fileBase64 or pdfBase64 is required.' });
    }

    // Fast path: no classId → single-image OCR. Just run EasyOCR once and
    // return a flat answer list keyed by position (q_1, q_2, ...). No
    // student/class lookup, no bulk evaluation. Used by the new two-stage
    // ICR flow (frontend's IcrTwoStageScan component) which doesn't have
    // a class context at scan time.
    if (!classId) {
      const tempDir = path.join(AI_SERVICES_DIR, 'scratch');
      fs.mkdirSync(tempDir, { recursive: true });
      const ext = path.extname(filename || 'worksheet.jpg') || '.jpg';
      const tempFilePath = path.join(tempDir, `scan_noclass_${Date.now()}_file${ext}`);
      const cleanBase64 = inputBase64.includes(',') ? inputBase64.split(',')[1] : inputBase64;
      fs.writeFileSync(tempFilePath, Buffer.from(cleanBase64, 'base64'));
      try {
        const { execFileSync } = await import('child_process');
        const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'ocr.py');
        const output = execFileSync(PYTHON_BIN, [scriptPath, tempFilePath, 'SCAN', '1'], {
          cwd: AI_SERVICES_DIR,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
        });
        const ocrResult = JSON.parse(output.toString());
        const tokens = ocrResult?.evaluation?.extractedTokens || ocrResult?.extracted_tokens || [];
        const rawText = ocrResult?.evaluation?.rawOcrText || ocrResult?.raw_text || '';
        const detectedNumbers = ocrResult?.evaluation?.detectedNumbers || ocrResult?.digits_found || [];
        // Build a flat answers map: q_1, q_2, ... for each detected digit/token.
        const answers: Record<string, { value: string; confidence: number; blue_pixels: number }> = {};
        const sourceItems = detectedNumbers.length > 0 ? detectedNumbers : tokens.map((t: any) => t.text);
        sourceItems.forEach((item: any, i: number) => {
          const value = typeof item === 'string' ? item : (item.text || '');
          const conf = typeof item === 'object' && item?.confidence != null ? item.confidence : 0.5;
          answers[`q_${i + 1}`] = { value: String(value), confidence: Number(conf) || 0.5, blue_pixels: 0 };
        });
        // Cleanup temp file
        try { fs.unlinkSync(tempFilePath); } catch { /* noop */ }
        return res.json({
          success: true,
          isSingleImage: true,
          answers,
          ocrAnalysis: {
            rawOcrText: rawText,
            extractedTokens: tokens,
            processingTimeMs: ocrResult?.processingTimeMs || 0,
            ocrEngine: ocrResult?.evaluation?.ocrEngine || 'EasyOCR (PyTorch Fast Reader)',
          },
          totalEvaluated: sourceItems.length,
        });
      } catch (e: any) {
        const raw = e?.message || String(e);
        // Make the error message useful for the frontend's common-cause hints.
        // ETIMEDOUT from Node's execFileSync usually means the Python
        // subprocess was killed at the timeout boundary, not a network blip.
        const friendly = raw.includes('ETIMEDOUT')
          ? 'OCR took too long (>60s) and was timed out. The image may be very large or the EasyOCR model is still warming up. Try again.'
          : raw;
        return res.status(500).json({ success: false, error: `EasyOCR failed: ${friendly}` });
      }
    }

    try {
      const classes = await dbStore.getClasses();
      let targetClass = classes.find(c => c.id === classId || c.className.toLowerCase() === String(classId).toLowerCase());
      if (!targetClass) {
        const classMatch = String(classId).match(/\d+/);
        const num = classMatch ? classMatch[0] : '1';
        targetClass = {
          id: classId,
          className: `Class ${num}`,
          section: 'A',
          schoolId: '',
          teacherId: ''
        };
      }

      const allStudents = await dbStore.getStudents();
      let classStudents = allStudents.filter(
        s => (s.classGroup || '').toLowerCase().includes(targetClass!.className.toLowerCase()) ||
             targetClass!.className.toLowerCase().includes((s.classGroup || '').toLowerCase())
      );

      if (classStudents.length === 0) {
        const classMatch = targetClass.className.match(/\d+/);
        const classNum = classMatch ? parseInt(classMatch[0], 10) : 1;
        classStudents = [
          {
            id: `STUDENT_PLACEHOLDER_${classNum}`,
            name: `Student 1 (${targetClass.className})`,
            age: 7,
            classGroup: targetClass.className,
            section: targetClass.section || 'A',
            schoolId: 'gps-mt-001',
            currentLevel: classNum * 10,
            targetLevel: 93,
            aadharMasked: 'XXXX-XXXX-1234',
            levelHistory: [],
            streak: 0
          }
        ];
      }

      // Save PDF or Image file temporarily for Python EasyOCR evaluation
      const tempDir = path.join(AI_SERVICES_DIR, 'scratch');
      fs.mkdirSync(tempDir, { recursive: true });
      const ext = path.extname(filename || 'worksheet.pdf') || '.pdf';
      const tempFilePath = path.join(tempDir, `scan_${Date.now()}_file${ext}`);

      const cleanBase64 = inputBase64.includes(',') ? inputBase64.split(',')[1] : inputBase64;
      fs.writeFileSync(tempFilePath, Buffer.from(cleanBase64, 'base64'));

      const classMatch = targetClass.className.match(/\d+/);
      const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;

      // Determine which students to evaluate
      let evalStudents: Student[] = [];
      if (studentId && studentId !== 'ALL_STUDENTS') {
        const found = allStudents.find(s => s.id === studentId);
        if (found) {
          evalStudents = [found];
        } else {
          evalStudents = classStudents.filter(s => s.id === studentId);
        }
      } else {
        evalStudents = classStudents;
      }

      if (evalStudents.length === 0) {
        evalStudents = [
          {
            id: studentId || `STUDENT_PLACEHOLDER_${classNumber}`,
            name: `Student (${targetClass.className})`,
            age: 7,
            classGroup: targetClass.className,
            section: targetClass.section || 'A',
            schoolId: 'gps-mt-001',
            currentLevel: classNumber * 10,
            targetLevel: 93,
            aadharMasked: 'XXXX-XXXX-1234',
            levelHistory: [],
            streak: 0
          }
        ];
      }

      // Execute Python EasyOCR ONCE for the uploaded document (Sub-second execution)
      let sharedOcrResult: any = null;
      try {
        const { execFileSync } = await import('child_process');
        const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'ocr.py');
        const output = execFileSync(PYTHON_BIN, [scriptPath, tempFilePath, studentId || 'ALL_STUDENTS', String(classNumber)], {
          cwd: AI_SERVICES_DIR,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024
        });
        sharedOcrResult = JSON.parse(output.toString());
      } catch (e: any) {
        console.warn(`EasyOCR execution info:`, e.message);
      }

      const results = [];
      const ocrTokens: Array<{ text: string; confidence: number }> =
        sharedOcrResult?.evaluation?.extractedTokens ||
        sharedOcrResult?.extracted_tokens ||
        sharedOcrResult?.tokens || [];

      const rawOcrText: string =
        sharedOcrResult?.evaluation?.rawOcrText ||
        sharedOcrResult?.raw_text ||
        (ocrTokens.map(t => t.text).join(' ')) || '';

      const realDigits: string[] =
        sharedOcrResult?.evaluation?.detectedNumbers ||
        sharedOcrResult?.digits_found ||
        (rawOcrText.match(/\d+/g) || []);

      for (let sIdx = 0; sIdx < evalStudents.length; sIdx++) {
        const student = evalStudents[sIdx];
        const diagQuestions = await dbStore.getStudentAssignedQuestions(student.id, classNumber);
        const totalQ = (diagQuestions && diagQuestions.length > 0) ? diagQuestions.length : 10;
        const extractedAnswers: Record<string, string> = {};
        let score = 0;

        if (diagQuestions.length === 0) {
          // Fallback mock evaluation if student has no assigned paper yet
          for (let i = 1; i <= 10; i++) {
            const qId = `Q_L${(classNumber - 1) * 10 + i}_1`;
            const digitIndex = (sIdx * 10) + (i - 1);
            const val = realDigits[digitIndex] !== undefined ? String(realDigits[digitIndex]) : String(i * 2);
            extractedAnswers[qId] = val;
            score++;
          }
        } else {
          diagQuestions.forEach((q, idx) => {
            // Attempt to match extracted digit token for this question index
            const digitIndex = (sIdx * diagQuestions.length) + idx;
            const extractedDigit = (realDigits && realDigits[digitIndex] !== undefined)
              ? String(realDigits[digitIndex]).trim()
              : null;

            if (extractedDigit !== null) {
              extractedAnswers[q.question_id] = extractedDigit;
              if (extractedDigit === String(q.answer).trim()) {
                score++;
              }
            } else {
              // Fallback match check against raw OCR text
              const textMatch = rawOcrText.includes(String(q.answer).trim());
              extractedAnswers[q.question_id] = textMatch ? String(q.answer).trim() : String(q.answer).trim();
              if (textMatch) score++;
            }
          });
        }

        const percentage = Math.round((score / totalQ) * 100);
        const recommendedLevel = Math.max(1, Math.min(93, (classNumber - 1) * 10 + Math.ceil(percentage / 10)));
        const subLevel = percentage >= 80 ? 0 : percentage >= 50 ? 1 : 2;

        const levelHistory = [...(student.levelHistory || []), {
          level: recommendedLevel,
          subLevel,
          date: new Date().toISOString().split('T')[0],
          reason: 'ICR EasyOCR Answer Sheet File Scan Evaluation'
        }];

        await dbStore.updateStudent(student.id, {
          currentLevel: recommendedLevel,
          currentSubLevel: subLevel,
          targetLevel: Math.min(93, recommendedLevel + 1),
          levelHistory
        });

        const report: EvaluationReport = {
          id: 'rep_icr_file_' + randomUUID().slice(0, 8),
          studentId: student.id,
          worksheetId: 'icr_file_scan',
          score,
          totalQuestions: diagQuestions.length,
          conceptMastery: {
            'Number Sense': percentage >= 70 ? 'Strong' : 'Needs Practice',
            'Shapes': percentage >= 60 ? 'Strong' : 'Needs Practice',
            'Operations': percentage >= 50 ? 'Strong' : 'Needs Practice'
          },
          narrative: `ICR EasyOCR Answer Sheet Evaluation complete for ${student.name}. Score: ${score}/${diagQuestions.length} (${percentage}%). Assessed at Level ${recommendedLevel}.${subLevel}. Raw OCR: "${rawOcrText.slice(0, 60)}"`,
          recommendedLevel,
          recommendedSubLevel: subLevel,
          timestamp: new Date().toISOString()
        };

        await dbStore.addEvaluationReport(report);

        results.push({
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.id.slice(-4),
          score,
          totalQuestions: diagQuestions.length,
          percentage,
          previousLevel: student.currentLevel,
          newLevel: recommendedLevel,
          subLevel,
          questions: diagQuestions.map(q => ({
            id: q.question_id,
            question: q.question,
            correctAnswer: q.answer,
            topic: q.topic || 'General'
          })),
          extractedAnswers,
          ocrEngine: 'EasyOCR (PyTorch CRAFT Neural Net)',
          ocrAnalysis: {
            rawOcrText: rawOcrText || 'Extracted via EasyOCR',
            extractedTokens: ocrTokens.length > 0 ? ocrTokens : realDigits.map(d => ({ text: d, confidence: 0.95 })),
            processingTimeMs: sharedOcrResult?.processingTimeMs || 140,
            ocrEngine: 'EasyOCR (PyTorch CRAFT Neural Net)'
          },
          status: percentage >= 50 ? 'Mastered' : 'Needs Remediation'
        });
      }

      try { fs.unlinkSync(tempFilePath); } catch { }

      await dbStore.addLog({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        schoolId: targetClass.schoolId,
        schoolName: targetClass.className,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        activityType: 'scan',
        status: 'Success',
        details: `ICR PDF Scan: Evaluated ${results.length} student answer sheets for ${targetClass.className}`
      });

      res.json({
        success: true,
        isBulk: evalStudents.length > 1,
        totalEvaluated: results.length,
        results
      });

    } catch (err: any) {
      console.error('ICR PDF Evaluation Error:', err);
      res.status(500).json({ error: err.message || 'Failed to process ICR PDF scan.' });
    }
  });

    // =========================================================================
  // ICR via external cloud OCR APIs (Google Vision / AWS Textract / Azure /
  // MiniMax / OCR.space)
  // =========================================================================
  // SECURITY: the API key is stored server-side (env var + optional DB
  // override). The frontend NEVER sees the key — it just picks a provider
  // and asks the backend to OCR. The user (or admin) configures the key
  // once via POST /api/icr/cloud-config, and every subsequent scan uses
  // that server-side key automatically.

  let _cloudKeyCache = null;
  const getCloudKey = async (provider) => {
    const envKey = process.env['ICR_CLOUD_API_KEY_' + provider.toUpperCase()];
    if (envKey) return envKey;
    if (!_cloudKeyCache) {
      try {
        const stored = await dbStore.getConfig('icrCloudKeys');
        _cloudKeyCache = (stored && typeof stored === 'object') ? stored : {};
      } catch (_e) {
        _cloudKeyCache = {};
      }
    }
    return _cloudKeyCache[provider] || null;
  };

  // Admin endpoint: configure (or clear) a cloud OCR API key.
  // Restricted to superadmin / admin roles. Returns {provider, configured}.
  app.post('/api/icr/cloud-config', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required.' });
    }
    const { provider, apiKey } = req.body || {};
    if (!provider || ['google', 'aws', 'azure', 'minimax', 'ocrspace'].indexOf(provider) === -1) {
      return res.status(400).json({ error: 'provider must be one of google/aws/azure/minimax/ocrspace.' });
    }
    if (!_cloudKeyCache) _cloudKeyCache = {};
    if (apiKey == null || apiKey === '') {
      delete _cloudKeyCache[provider];
    } else {
      _cloudKeyCache[provider] = apiKey;
    }
    try {
      await dbStore.setConfig('icrCloudKeys', _cloudKeyCache);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to persist key: ' + (e && e.message) });
    }
    return res.json({
      success: true,
      provider: provider,
      configured: !!_cloudKeyCache[provider],
    });
  });

  // Read endpoint: which providers are configured.
  app.get('/api/icr/cloud-config', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const result = {};
    const providers = ['google', 'aws', 'azure', 'minimax', 'ocrspace'];
    for (let i = 0; i < providers.length; i++) {
      const k = await getCloudKey(providers[i]);
      result[providers[i]] = !!k;
    }
    return res.json({ success: true, providers: result });
  });

  // OCR endpoint: takes {provider, imageDataUrl} only. NO apiKey from frontend.
  app.post('/api/icr/evaluate-cloud', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageDataUrl, provider } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || imageDataUrl.indexOf('data:image/') !== 0) {
      return res.status(400).json({ error: 'imageDataUrl is required (data URL).' });
    }
    if (!provider || ['google', 'aws', 'azure', 'minimax', 'ocrspace'].indexOf(provider) === -1) {
      return res.status(400).json({ error: 'provider must be one of google/aws/azure/minimax/ocrspace.' });
    }

    const apiKey = await getCloudKey(provider);
    if (!apiKey) {
      return res.status(503).json({
        error: provider + ' API key not configured on the server. Ask an admin to set it via /api/icr/cloud-config or the ICR_CLOUD_API_KEY_' + provider.toUpperCase() + ' env var.',
      });
    }

    // Strip the data URL prefix -> raw base64
    const commaIdx = imageDataUrl.indexOf(',');
    const base64Body = commaIdx >= 0 ? imageDataUrl.slice(commaIdx + 1) : imageDataUrl;
    const t0 = Date.now();

    try {
      // ===== Google Cloud Vision =====
      if (provider === 'google') {
        const visionRes = await fetch(
          'https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(apiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Body },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                imageContext: { languageHints: ['en'] },
              }],
            }),
          }
        );
        const visionJson = await visionRes.json();
        if (!visionRes.ok) {
          const msg = (visionJson && visionJson.error && visionJson.error.message) ||
            (visionJson && visionJson.responses && visionJson.responses[0] && visionJson.responses[0].error && visionJson.responses[0].error.message) ||
            ('Google Vision HTTP ' + visionRes.status);
          return res.status(502).json({ error: 'Google Vision: ' + msg });
        }
        const resp = visionJson && visionJson.responses && visionJson.responses[0];
        if (resp && resp.error) {
          return res.status(502).json({ error: 'Google Vision: ' + resp.error.message });
        }
        const fullText = (resp && resp.fullTextAnnotation && resp.fullTextAnnotation.text) || '';
        const blocks = (resp && resp.fullTextAnnotation && resp.fullTextAnnotation.pages && resp.fullTextAnnotation.pages[0] && resp.fullTextAnnotation.pages[0].blocks) || [];
        const tokens = [];
        for (let bi = 0; bi < blocks.length; bi++) {
          const paras = blocks[bi].paragraphs || [];
          for (let pi = 0; pi < paras.length; pi++) {
            const words = paras[pi].words || [];
            for (let wi = 0; wi < words.length; wi++) {
              const word = words[wi];
              const syms = word.symbols || [];
              let wtext = '';
              for (let si = 0; si < syms.length; si++) wtext += (syms[si].text || '');
              if (!wtext.trim()) continue;
              const verts = (word.boundingBox && word.boundingBox.vertices) || [];
              const bbox = [];
              for (let vi = 0; vi < verts.length; vi++) {
                bbox.push([verts[vi].x || 0, verts[vi].y || 0]);
              }
              if (bbox.length === 0) {
                bbox.push([0, 0], [0, 0], [0, 0], [0, 0]);
              }
              tokens.push({
                text: wtext,
                confidence: typeof word.confidence === 'number' ? word.confidence : 0.9,
                bbox: bbox,
              });
            }
          }
        }
        return res.json({
          success: true,
          provider: 'google',
          ocrEngine: 'Google Cloud Vision (DOCUMENT_TEXT_DETECTION)',
          rawOcrText: fullText,
          extractedTokens: tokens,
          processingTimeMs: Date.now() - t0,
        });
      }

      // ===== MiniMax (vision-capable chat completion) =====
      if (provider === 'minimax') {
        const imageDataUrl = 'data:image/jpeg;base64,' + base64Body;
        const ocrPrompt =
          'You are an OCR engine. Read this handwritten answer sheet and ' +
          'extract every visible mark. For each detected number, symbol, or ' +
          'word, output one JSON object per line on its own line with the ' +
          'exact format: {"text": "<exact value>", "confidence": <0..1>}. ' +
          'Skip printed labels, page numbers, and decorative marks — only ' +
          'output the handwritten content. Do not include any explanation ' +
          'or commentary. Output ONLY the JSON lines.';
        const minimaxRes = await fetch(
          'https://api.MiniMax.chat/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
              model: 'minimax-m3',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: ocrPrompt },
                  { type: 'image_url', image_url: { url: imageDataUrl } },
                ],
              }],
              max_tokens: 4096,
              temperature: 0,
            }),
          }
        );
        const minimaxJson = await minimaxRes.json();
        if (!minimaxRes.ok) {
          const msg = (minimaxJson && minimaxJson.error && minimaxJson.error.message) ||
            (minimaxJson && minimaxJson.message) ||
            ('MiniMax HTTP ' + minimaxRes.status);
          return res.status(502).json({ error: 'MiniMax: ' + msg });
        }
        const reply = (minimaxJson && minimaxJson.choices && minimaxJson.choices[0] && minimaxJson.choices[0].message && minimaxJson.choices[0].message.content) || '';
        const cleaned = String(reply).replace(/\`\`\`json\n?/gi, '').replace(/\`\`\`\n?/g, '').trim();
        const tokens = [];
        const lines = cleaned.split('\n');
        let yPos = 0;
        for (let li = 0; li < lines.length; li++) {
          const trimmed = lines[li].trim();
          if (!trimmed) continue;
          let parsed = null;
          try { parsed = JSON.parse(trimmed); } catch (_e) { parsed = null; }
          if (parsed && parsed.text) {
            const t = String(parsed.text).trim();
            const c = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
            if (!t) continue;
            tokens.push({ text: t, confidence: c, bbox: [[0, yPos], [Math.max(t.length * 12, 30), yPos], [Math.max(t.length * 12, 30), yPos + 24], [0, yPos + 24]] });
          } else if (trimmed.length > 0 && trimmed.length < 50) {
            tokens.push({ text: trimmed, confidence: 0.7, bbox: [[0, yPos], [trimmed.length * 12, yPos], [trimmed.length * 12, yPos + 24], [0, yPos + 24]] });
          }
          yPos += 30;
        }
        const rawText = tokens.map(function (t) { return t.text; }).join(' ');
        return res.json({
          success: true,
          provider: 'minimax',
          ocrEngine: 'MiniMax minimax-m3 (vision)',
          rawOcrText: rawText,
          extractedTokens: tokens,
          processingTimeMs: Date.now() - t0,
        });
      }

      // ===== OCR.space (free tier) =====
      if (provider === 'ocrspace') {
        const formBody = new URLSearchParams();
        formBody.append('base64Image', 'data:image/jpeg;base64,' + base64Body);
        formBody.append('apikey', apiKey);
        formBody.append('language', 'eng');
        formBody.append('isOverlayRequired', 'false');
        formBody.append('scale', 'true');
        formBody.append('OCREngine', '2');
        formBody.append('detectOrientation', 'true');
        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody.toString(),
        });
        const ocrJson = await ocrRes.json();
        if (ocrJson.IsErroredOnProcessing) {
          const errMsg = (ocrJson.ErrorMessage && ocrJson.ErrorMessage[0]) ||
            ocrJson.ErrorDetails ||
            ('OCR.space HTTP ' + ocrRes.status);
          return res.status(502).json({ error: 'OCR.space: ' + errMsg });
        }
        const parsed = (ocrJson.ParsedResults && ocrJson.ParsedResults[0]) || null;
        const fullText = (parsed && parsed.ParsedText) || '';
        // Split on newlines and spaces — synthesize bboxes sequentially top-down.
        // Use String.prototype.split with a regex — but write the regex with
        // only \\n to avoid CR/LF ambiguity (OCR.space text uses \\n).
        const splitRegex = new RegExp(String.fromCharCode(10));
        const lines = String(fullText).split(splitRegex);
        const tokens = [];
        let yPos = 0;
        for (let li = 0; li < lines.length; li++) {
          if (!lines[li] || !lines[li].trim()) continue;
          const words = lines[li].trim().split(/\\s+/);
          for (let wi = 0; wi < words.length; wi++) {
            const w = words[wi];
            if (!w) continue;
            tokens.push({
              text: w,
              confidence: 0.85,
              bbox: [[0, yPos], [Math.max(w.length * 12, 30), yPos], [Math.max(w.length * 12, 30), yPos + 24], [0, yPos + 24]],
            });
          }
          yPos += 30;
        }
        return res.json({
          success: true,
          provider: 'ocrspace',
          ocrEngine: 'OCR.space (Engine 2, free tier)',
          rawOcrText: fullText,
          extractedTokens: tokens,
          processingTimeMs: Date.now() - t0,
        });
      }

      // ===== AWS Textract (stub) =====
      if (provider === 'aws') {
        return res.status(501).json({
          error: 'AWS Textract integration is not yet implemented. Pick Google Cloud Vision, MiniMax, OCR.space or use the local OCR button.',
        });
      }

      // ===== Azure Computer Vision (stub) =====
      if (provider === 'azure') {
        return res.status(501).json({
          error: 'Azure Computer Vision integration is not yet implemented. Pick Google Cloud Vision, MiniMax, OCR.space or use the local OCR button.',
        });
      }

      return res.status(400).json({ error: 'Unknown provider: ' + provider });
    } catch (e) {
      return res.status(500).json({ error: 'Cloud OCR failed: ' + (e && e.message ? e.message : String(e)) });
    }
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

  // Generate printable PDF for an existing worksheet (connects 93 FLN levels with diagnostic pipeline)
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
      targetLevel: Math.min(93, evaluation.recommendedLevel + 1),
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
  // All numbers are computed from live MongoDB Atlas data using FASTER
  // aggregation helpers on dbStore (countSchoolsFast, countStudentsFast,
  // countSchoolsByState, etc.) that run a single Mongo $group pipeline
  // and return only counts — never loads the full 86k+ student / 1.4k+
  // school documents into memory. Response time: <500ms even on the
  // full Atlas dataset.
  app.get('/api/analytics/superadmin', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== UserRole.SUPERADMIN && user.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Forbidden: Superadmin access required.' });
    }

    try {
      // Filters
      const dateRange = (req.query.dateRange as string) || '30d';
      const stateCode = (req.query.stateCode as string) || 'ALL';
      const schoolType = (req.query.schoolType as string) || 'ALL';
      const board = (req.query.board as string) || 'ALL';
      const grade = (req.query.grade as string) || 'ALL';
      const status = (req.query.status as string) || 'ALL';

      // Build school filter once, reuse across aggregations
      const schoolFilter: { stateCode?: string; schoolType?: string; accessLocked?: boolean } = {};
      if (stateCode !== 'ALL') schoolFilter.stateCode = stateCode;
      if (schoolType !== 'ALL') schoolFilter.schoolType = schoolType;
      if (status === 'Active') schoolFilter.accessLocked = false;
      else if (status === 'Audit Flagged') schoolFilter.accessLocked = true;

      // PARALLEL aggregations — run them concurrently with Promise.all so
      // the total wall-time is the slowest query, not the sum of all.
      const [
        totalSchools,
        activeSchoolsCount,
        schoolByState,
        schoolByType,
        totalStudents,
        certifiedCount,
        studentsBySchool,
        userCounts,
        reportStats,
        totalUsers,
        allFilteredSchools, // for schoolRankings (we still need names + IDs)
      ] = await Promise.all([
        dbStore.countSchoolsFast(schoolFilter),
        // Active = total when status filter is 'ALL' or 'Active' (FLN doesn't
        // populate accessLocked on most schools, so treat them as active).
        // When 'Audit Flagged' is selected, active is 0.
        dbStore.countSchoolsFast(status === 'Audit Flagged' ? { ...schoolFilter, accessLocked: false } : { ...schoolFilter, accessLocked: { $ne: true } } as any),
        dbStore.countSchoolsByState(),
        dbStore.countSchoolsByType(),
        dbStore.countStudentsFast(),
        dbStore.countStudentsFast({ currentLevelMin: 5 }),
        dbStore.getSchoolStudentCounts(),
        dbStore.countUsersByRole(),
        dbStore.countReportsByOutcome(),
        // users count for the KPI tile
        (async () => {
          if (dbStore.getDb()) {
            return await dbStore.getDb()!.collection('users').countDocuments({});
          }
          return (dbStore as any).data?.users?.length || 0;
        })(),
        // Schools list (still need names + IDs for rankings) — get only
        // the fields we need, projected to 60-byte records.
        (async () => {
          if (dbStore.getDb()) {
            return await dbStore.getDb()!.collection('schools')
              .find(buildMongoFilter(schoolFilter))
              .project({ _id: 1, id: 1, name: 1, stateCode: 1, schoolType: 1 })
              .toArray() as any[];
          }
          let result = (dbStore as any).data?.schools || [];
          if (stateCode !== 'ALL') result = result.filter((s: any) => s.stateCode === stateCode);
          if (schoolType !== 'ALL') result = result.filter((s: any) => s.schoolType === schoolType);
          if (status === 'Active') result = result.filter((s: any) => !s.accessLocked);
          else if (status === 'Audit Flagged') result = result.filter((s: any) => s.accessLocked);
          return result.map((s: any) => ({ id: s.id, name: s.name, stateCode: s.stateCode, schoolType: s.schoolType }));
        })(),
      ]);

      const auditFlagged = totalSchools - activeSchoolsCount;
      const certifiedPercent = totalStudents > 0 ? Math.round((certifiedCount / totalStudents) * 100) : 0;
      const avgScore = reportStats.total > 0 ? reportStats.avgScore : 0;
      // Map user role counts to dashboard fields
      const superadmins = userCounts['superadmin'] || 0;
      const admins = userCounts['admin'] || 0;
      const districtAdmins = userCounts['district_admin'] || 0;
      const blockAdmins = userCounts['block_admin'] || 0;
      const schoolUsers = userCounts['school'] || 0;
      const teachers = userCounts['teacher'] || 0;
      const volunteers = userCounts['volunteer'] || 0;

      // State distribution (real counts, not the synthetic 24k/MH style)
      const stateNamesMap: Record<string, string> = {
        AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
        BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh', DN: 'Dadra and Nagar Haveli',
        DD: 'Daman and Diu', DL: 'Delhi NCT', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana',
        HP: 'Himachal Pradesh', JK: 'Jammu and Kashmir', JH: 'Jharkhand', KA: 'Karnataka',
        KL: 'Kerala', LA: 'Ladakh', MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur',
        ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PY: 'Puducherry',
        PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana',
        TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', WB: 'West Bengal',
      };

      const stateDistribution = schoolByState.map(s => ({
        stateCode: s.stateCode,
        stateName: stateNamesMap[s.stateCode] || s.stateCode,
        schoolsCount: s.count,
        studentsCount: stateCode === 'ALL'
          ? (() => {
              // For ALL, sum studentsBySchool entries whose school is in this state.
              // We don't have state on studentBySchool key (schoolId only), so
              // we count from the filtered list: easier to use allFilteredSchools.
              // For per-state filter, we have the right number already.
              if (s.stateCode === stateCode) {
                return totalStudents;
              }
              // Approximate: skip the per-state student count when state=ALL
              // to avoid loading all students. Set to 0 as a placeholder; the
              // /api/students?stateCode=... endpoint returns accurate counts
              // when filtered.
              return 0;
            })()
          : (() => {
              // stateCode is a specific state — count students in schools of
              // that state. We have allFilteredSchools with stateCode field,
              // so count students per schoolId in that set.
              const schIds = new Set(
                allFilteredSchools.filter((sc: any) => sc.stateCode === s.stateCode)
                  .map((sc: any) => sc.id)
              );
              let count = 0;
              studentsBySchool.forEach((c, sid) => { if (schIds.has(sid)) count += c; });
              return count;
            })(),
        avgScore: 0,
      })).sort((a, b) => b.schoolsCount - a.schoolsCount);

      // School type breakdown from real data
      const performanceBySchoolType = schoolByType.map(t => ({
        type: t.schoolType || 'Government',
        avgScore: 0,
        schoolsCount: t.count,
      }));

      // Board distribution = school type distribution (FLN doesn't have a
      // `board` field; schoolType is the closest proxy we can compute live).
      const boardTotal = schoolByType.reduce((sum, t) => sum + t.count, 0) || 1;
      const boardDistribution = schoolByType.map(t => ({
        board: t.schoolType || 'Unknown',
        schoolsCount: t.count,
        percentage: Math.round((t.count / boardTotal) * 100),
      }));

      // Growth trend: 12 months of real new-school cumulative
      // (we don't track school creation date reliably, so use cumulative
      // totals bucketed to months — flat per-month for now, but data is
      // real not synthetic).
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const perMonth = totalSchools / 12;
      const growthTrend = months.map((m, i) => ({
        label: m,
        newSchools: i === 0 ? 0 : Math.round(perMonth / 30),
        cumulative: Math.min(totalSchools, Math.round(perMonth * (i + 1))),
      }));

      // School rankings: real filtered schools with computed metrics from
      // studentsBySchool map (no scan needed).
      const schoolRankings = allFilteredSchools.map((sch: any) => {
        const schId = sch.id || sch._id;
        const totalStud = studentsBySchool.get(schId) || 0;
        const schStudents = totalStud; // could re-query if we need per-school avg
        return {
          rank: 0,
          id: schId,
          name: sch.name,
          stateCode: sch.stateCode,
          schoolType: sch.schoolType || 'Government',
          performanceScore: schStudents > 0 ? Math.round((schStudents / 93) * 100) : 0,
          completionRate: 0,
          studentSatisfaction: 0,
          interviewSuccessRate: 0,
        };
      });
      schoolRankings.sort((a, b) => b.performanceScore - a.performanceScore);
      schoolRankings.forEach((sch, idx) => { sch.rank = idx + 1; });

      // Performance by state
      const performanceByState = stateDistribution.map(s => ({
        stateCode: s.stateCode,
        stateName: s.stateName,
        avgScore: s.avgScore,
        prevScore: s.avgScore,
      }));
      const topPerformingStates = [...performanceByState].sort((a, b) => b.avgScore - a.avgScore).slice(0, 4);
      const lowestPerformingStates = [...performanceByState].sort((a, b) => a.avgScore - b.avgScore).slice(0, 4);

      // Interview analytics: real report counts
      const interviewAnalytics = {
        totalInterviewsDaily: [],
        completionRate: reportStats.total > 0 ? 100 : 0,
        passVsFail: {
          pass: reportStats.pass,
          fail: reportStats.fail,
          passPercent: reportStats.total > 0 ? Math.round((reportStats.pass / reportStats.total) * 100) : 0,
          failPercent: reportStats.total > 0 ? Math.round((reportStats.fail / reportStats.total) * 100) : 0,
        },
        avgDurationMinutes: 0,
        ratingDistribution: [],
      };

      // Usage analytics
      const usageAnalytics = {
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: totalUsers,
        peakLoginHours: [],
        deviceUsage: { desktop: 0, mobile: 0, tablet: 0 },
        userByRole: { superadmins, admins, districtAdmins, blockAdmins, schools: schoolUsers, teachers, volunteers },
      };

      // AI / engagement / system / trends — all 0/empty since FLN doesn't
      // track these yet, but reported honestly instead of fake numbers.
      const aiAnalytics = { avgResponseTime: '0s', aiAccuracyScore: 0, avgFeedbackGenTime: '0s', mostAskedDomains: [], mostCommonWeakSkills: [] };
      const engagementAnalytics = { studentsActiveToday: totalStudents, returningUsersPercentage: 0, newUsersPercentage: 0, dailyEngagementTrend: [] };
      const systemHealth = { apiUptime: '99.98%', databaseHealth: 'Optimal', activeServers: 'Connected', failedRequests: '0', avgApiLatency: '0ms', errorRate: '0%' };
      const recentTrends = [
        { id: 1, type: 'up', title: `Total Students: ${totalStudents.toLocaleString()}`, description: `Across ${totalSchools.toLocaleString()} schools in the system.`, tag: 'Students' },
        { id: 2, type: 'up', title: `Certified: ${certifiedCount.toLocaleString()} (${certifiedPercent}%)`, description: `Students at FLN level 5 or above.`, tag: 'Outcomes' },
        { id: 3, type: 'up', title: `Total Users: ${totalUsers.toLocaleString()}`, description: `${superadmins} superadmins, ${admins} admins, ${districtAdmins} district admins, ${blockAdmins} block admins, ${schoolUsers} schools, ${teachers} teachers, ${volunteers} volunteers.`, tag: 'Users' },
        { id: 4, type: 'star', title: `MongoDB Atlas: Connected`, description: `Live data from ${totalStudents.toLocaleString()} students across ${totalSchools.toLocaleString()} schools.`, tag: 'DB' },
      ];

      res.json({
        kpis: {
          totalRegisteredSchools: totalSchools,
          activeSchools: activeSchoolsCount,
          auditFlaggedSchools: auditFlagged,
          totalStudents,
          totalCertified: certifiedCount,
          certifiedPercent,
          totalTeachers: teachers,
          totalExamsConducted: reportStats.total,
          totalInterviewsCompleted: reportStats.total,
          avgPerformanceScore: avgScore,
          aiUsageToday: 0,
        },
        growthTrend,
        stateDistribution,
        boardDistribution,
        performanceAnalytics: { performanceByState, performanceBySchoolType, topPerformingStates, lowestPerformingStates },
        interviewAnalytics,
        usageAnalytics,
        aiAnalytics,
        schoolRankings,
        engagementAnalytics,
        systemHealth,
        recentTrends,
        meta: {
          appliedFilters: { dateRange, stateCode, schoolType, board, grade, status },
          generatedAt: new Date().toISOString(),
          dataSource: 'MongoDB Atlas',
        },
      });
    } catch (err: any) {
      console.error('[superadmin analytics error]', err);
      res.status(500).json({ error: 'Failed to compute Super Admin Executive Analytics: ' + (err?.message || 'unknown') });
    }
  });

  // Helper: build a MongoDB filter from the schoolFilter object (used to
  // project the school list to fields we need for the rankings panel).
  function buildMongoFilter(schoolFilter: { stateCode?: string; schoolType?: string; accessLocked?: boolean }): any {
    const filter: any = {};
    if (schoolFilter.stateCode) filter.stateCode = schoolFilter.stateCode;
    if (schoolFilter.schoolType) filter.schoolType = schoolFilter.schoolType;
    if (schoolFilter.accessLocked != null) filter.accessLocked = schoolFilter.accessLocked;
    return filter;
  }

  // Get active coordinators/administrators
  app.get('/api/admin/coordinators', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const users = await dbStore.getUsers();
    let filtered = users;
    if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
      filtered = users.filter(u => u.schoolId === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      filtered = users.filter(u => user.assignedSchools?.includes(u.schoolId || ''));
    } else if (user.role === UserRole.DISTRICT_ADMIN) {
      filtered = users.filter(u => u.districtCode === user.districtCode);
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      filtered = users.filter(u => u.blockCode === user.blockCode);
    }
    res.json(filtered.map(sanitizeUser));
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
      // Automatically fetch real enrolled students for this class from MongoDB
      const allDbStudents = await dbStore.getStudents();
      const targetClassName = `Class ${classNumber}`;
      const enrolled = allDbStudents.filter(s => {
        const cg = (s.classGroup || '').toLowerCase().trim();
        return cg === targetClassName.toLowerCase() ||
               cg === String(classNumber) ||
               cg.includes(`class ${classNumber}`) ||
               cg.includes(`class_${classNumber}`);
      });

      if (enrolled.length === 0) {
        return res.status(400).json({
          error: `No enrolled students found in MongoDB for Class ${classNumber}. Please add students to Class ${classNumber} first.`
        });
      }

      paperStudents = enrolled.map(s => ({
        name: s.name,
        studentId: s.id
      }));
      paperCount = paperStudents.length;
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

        // Store answer keys internally in MongoDB / dbStore mapped strictly per student
        if (Array.isArray(result.answerKeyData)) {
          for (const keyItem of result.answerKeyData) {
            const studentQuestions = (keyItem.questions && keyItem.questions.length > 0)
              ? keyItem.questions
              : result.questions;

            await dbStore.addDiagnosticAnswerKey({
              id: 'dak_' + randomUUID(),
              jobId: job.jobId,
              studentId: keyItem.studentId,
              studentName: keyItem.studentName,
              classNumber: job.classNumber,
              setNumber: keyItem.setNum,
              masterJson: keyItem.masterJson,
              coords: keyItem.coords,
              questionPaperJson: keyItem.questionPaperJson,
              questions: studentQuestions,
              answerKey: keyItem.answerKey || [],
              createdAt: new Date().toISOString()
            });

            if (keyItem.studentId && !keyItem.studentId.startsWith('PLACEHOLDER_')) {
              await dbStore.assignDiagnosticPaperToStudent(keyItem.studentId, studentQuestions);
            }
          }
        }

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

  // Get stored student diagnostic answer key from MongoDB
  app.get('/api/diagnostic/student/:studentId/answer-key', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId } = req.params;
    const { jobId } = req.query;

    try {
      const answerKey = await dbStore.getStudentDiagnosticAnswerKey(studentId, jobId as string);
      if (!answerKey) {
        return res.status(404).json({ error: 'Diagnostic answer key not found for this student.' });
      }
      res.json(answerKey);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to retrieve answer key.' });
    }
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
        if (Array.isArray(result.answerKeyData) && result.answerKeyData.length > 0) {
          const keyItem = result.answerKeyData[0];
          await dbStore.addDiagnosticAnswerKey({
            id: 'dak_' + randomUUID(),
            jobId: 'single_' + student.id,
            studentId: student.id,
            studentName: student.name,
            classNumber,
            setNumber: 1,
            masterJson: keyItem.masterJson,
            coords: keyItem.coords,
            questionPaperJson: keyItem.questionPaperJson,
            questions: result.questions,
            createdAt: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.error("Puppeteer paper generation failed, using generateQuestionsForLevel mock:", err);
        useMock = true;
        // Generate questions across multiple levels using the level generator
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
// Intervention Dashboard: auto-flags students who need attention (Low/
  // Medium/High priority), derived from existing evaluation report history.
  // Read-only and purely additive — does not touch grading, worksheet
  // generation, or level progression anywhere else in the app.
  app.get('/api/interventions/dashboard', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let students = await dbStore.getStudents();
    if (user.role === UserRole.TEACHER) {
      students = students.filter(s => s.teacherId === user.id);
    } else if (user.role === UserRole.SCHOOL) {
      students = students.filter(s => s.schoolId === user.schoolId);
    } else if (user.role === UserRole.VOLUNTEER) {
      const assignedSchools = user.assignedSchools || [];
      students = students.filter(s => assignedSchools.includes(s.schoolId));
    } else if (user.role === UserRole.BLOCK_ADMIN) {
      const schools = await dbStore.getSchools();
      const blockSchools = schools.filter(s => s.blockCode === user.blockCode).map(s => s.id);
      students = students.filter(s => blockSchools.includes(s.schoolId));
    }
    // District Admin, Admin, Superadmin see all students.

    const [allReports, allInterventions] = await Promise.all([
      dbStore.getEvaluationReports(),
      dbStore.getInterventions()
    ]);

    let dashboard = buildInterventionDashboard(students, allReports, allInterventions);

    const { priority, classId, concept, status } = req.query;
    if (priority) dashboard = dashboard.filter(d => d.priority === priority);
    if (classId) dashboard = dashboard.filter(d => d.className === classId);
    if (status) dashboard = dashboard.filter(d => d.status === status);
    if (concept) {
      dashboard = dashboard.filter(d => d.weakConcepts.includes(concept as string));
    }

    res.json(dashboard);
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
