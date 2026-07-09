import { loadMockDB, saveMockDB, getInitialSeedData, MockDatabaseSchema } from './dbStore';
import { generateQuestionsForLevel } from '../utils/levelGenerator';
import { UserRole, Student, Worksheet, AnswerSubmission, EvaluationReport, Ticket, LogEntry, Announcement, Question } from '../types';

// Deterministic mock grading for Diagnostic
function evaluateDiagnosticMock(
  studentName: string,
  questions: any[],
  answers: { [key: string]: string }
): { score: number; recommendedLevel: number; narrative: string } {
  let score = 0;
  let recommendedLevel = 1;

  questions.forEach((q) => {
    const submitted = (answers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (submitted === correct) {
      score++;
    }
  });

  const failedLevels: number[] = [];
  questions.forEach((q) => {
    const submitted = (answers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    if (submitted !== correct) {
      failedLevels.push(q.source_level);
    }
  });

  if (failedLevels.length > 0) {
    recommendedLevel = Math.min(...failedLevels);
  } else {
    const maxLevel = Math.max(...questions.map((q: any) => q.source_level), 0);
    recommendedLevel = Math.min(59, maxLevel + 1);
  }

  const accuracy = Math.round((score / questions.length) * 100);
  const narrative = `============================================================
            NATIONAL FLN PORTAL ASSESSMENT REPORT
============================================================
Student Name: ${studentName}
Diagnostic Accuracy: ${accuracy}% (${score} / ${questions.length} correct)
Placed Level: Level ${recommendedLevel}

CORE CONCEPT ANALYSIS:
- Number Sense: ${recommendedLevel >= 12 ? 'Demonstrates stable counting and sequence tracking.' : 'Exhibits foundational gaps in one-to-one correspondence and classification.'}
- Operations: ${recommendedLevel >= 16 ? 'Capable of executing simple arithmetic operations.' : 'Requires additional practice sheets for basic single-digit addition/subtraction.'}

REMEDIAL RECOMMENDATIONS:
- Align remediation cycle immediately with Level ${recommendedLevel} objectives.
- Practice daily drills on weakest areas (classification and matching).
- Target next-step milestone: Level ${Math.min(59, recommendedLevel + 1)} within 4 weeks.`;

  return {
    score,
    recommendedLevel,
    narrative
  };
}

// Deterministic mock grading for classroom level worksheets
function evaluateWorksheetMock(
  studentName: string,
  level: number,
  questions: any[],
  answers: { [key: string]: string }
): {
  score: number;
  total: number;
  conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' };
  narrative: string;
  recommendedLevel: number;
} {
  let score = 0;
  const conceptMastery: { [topic: string]: 'Strong' | 'Needs Practice' | 'Satisfactory' } = {};

  questions.forEach((q) => {
    const submitted = (answers[q.question_id] || '').trim().toLowerCase();
    const correct = q.answer.trim().toLowerCase();
    const isCorrect = submitted === correct;

    if (isCorrect) score++;

    const topic = q.topic || 'General Mathematics';
    if (!conceptMastery[topic]) {
      conceptMastery[topic] = isCorrect ? 'Strong' : 'Needs Practice';
    } else if (conceptMastery[topic] === 'Needs Practice' && isCorrect) {
      conceptMastery[topic] = 'Satisfactory';
    }
  });

  const percent = questions.length > 0 ? (score / questions.length) * 100 : 0;
  const recommendedLevel = percent >= 80 ? Math.min(59, level + 1) : level;

  return {
    score,
    total: questions.length,
    conceptMastery,
    recommendedLevel,
    narrative: `Graded in-browser: ${studentName} successfully completed ${score} out of ${questions.length} questions (${percent.toFixed(0)}%). Progression: recommended level is Level ${recommendedLevel}.`
  };
}

// Helper to resolve authorization header
function getAuthUser(headers: HeadersInit | undefined, db: MockDatabaseSchema) {
  let token = '';
  if (headers) {
    if (headers instanceof Headers) {
      token = headers.get('Authorization') || '';
    } else if (Array.isArray(headers)) {
      const auth = headers.find(h => h[0].toLowerCase() === 'authorization');
      token = auth ? auth[1] : '';
    } else {
      token = (headers as any)['Authorization'] || (headers as any)['authorization'] || '';
    }
  }
  const email = token.replace('Bearer ', '').trim();
  if (!email) return null;

  const found = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (found) return found;

  if (email.endsWith('@fln.org')) {
    const parts = email.split('@')[0];
    let role = UserRole.TEACHER;
    let name = 'User';
    let schoolId: string | undefined = undefined;

    if (email === 'superadmin@fln.org') {
      role = UserRole.SUPERADMIN;
      name = 'Jinal Gupta';
    } else if (email.startsWith('admin.')) {
      role = UserRole.ADMIN;
      name = 'State Admin';
    } else if (email.startsWith('district.')) {
      role = UserRole.DISTRICT_ADMIN;
      name = 'District Officer';
    } else if (email.startsWith('block.')) {
      role = UserRole.BLOCK_ADMIN;
      name = 'Block Coordinator';
    } else if (email.startsWith('vol.')) {
      role = UserRole.VOLUNTEER;
      name = 'Volunteer';
    } else if (parts.includes('.t')) {
      role = UserRole.TEACHER;
      name = 'Teacher';
      schoolId = parts.split('.t')[0];
    } else {
      role = UserRole.SCHOOL;
      name = 'School Principal';
      schoolId = parts;
    }

    return {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      email,
      name,
      role,
      schoolId
    };
  }

  return null;
}

// Intercept window.fetch
export function setupFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : (input as Request).url;
    
    // Only intercept /api/ routes
    if (!url.includes('/api/')) {
      return originalFetch(input, init);
    }

    const method = (init?.method || 'GET').toUpperCase();
    const headers = init?.headers;
    const bodyData = init?.body ? JSON.parse(init.body as string) : {};

    const db = loadMockDB();
    const currentUser = getAuthUser(headers, db);

    const path = url.split('?')[0].replace(/^(https?:\/\/[^\/]+)?/, '');
    
    // Helper to format mock responses
    const jsonResponse = (data: any, status = 200) => {
      return Promise.resolve(new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      }));
    };

    const errorResponse = (msg: string, status = 400) => {
      return jsonResponse({ error: msg }, status);
    };

    console.log(`[Mock Fetch Interceptor] ${method} ${path}`, bodyData);

    try {
      // 1. POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = bodyData;
        if (!email || !password) {
          return errorResponse('Email and password are required.');
        }
        
        // Simple mock complexity verification to test input validation
        if (password.length < 8) {
          return errorResponse('Password does not meet complexity requirements (min 8 chars).');
        }

        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          return errorResponse('Invalid email or password', 401);
        }

        return jsonResponse({ token: user.email, user });
      }

      // 2. GET /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        return jsonResponse({ user: currentUser });
      }

      // 3. GET /api/announcements
      if (path === '/api/announcements' && method === 'GET') {
        return jsonResponse(db.announcements);
      }

      // 4. POST /api/announcements/create
      if (path === '/api/announcements/create' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { title, message, isUrgent } = bodyData;
        const newAnn: Announcement = {
          id: 'ann_' + Date.now(),
          title,
          message,
          isUrgent: !!isUrgent,
          authorEmail: currentUser.email,
          createdAt: new Date().toISOString()
        };
        db.announcements.unshift(newAnn);
        saveMockDB(db);
        return jsonResponse(newAnn);
      }

      // 5. GET /api/tickets
      if (path === '/api/tickets' && method === 'GET') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        if (currentUser.role === UserRole.SUPERADMIN) {
          return jsonResponse(db.tickets);
        }
        return jsonResponse(db.tickets.filter(t => t.userId === currentUser.id));
      }

      // 6. POST /api/tickets/create
      if (path === '/api/tickets/create' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { type, subject, description } = bodyData;
        const newTkt: Ticket = {
          id: 'tkt_' + Date.now(),
          userId: currentUser.id,
          userEmail: currentUser.email,
          userName: currentUser.name,
          userRole: currentUser.role,
          type: type || 'general',
          subject,
          description,
          status: 'Open',
          createdAt: new Date().toISOString()
        };
        db.tickets.unshift(newTkt);
        saveMockDB(db);
        return jsonResponse(newTkt);
      }

      // 7. POST /api/tickets/:id/resolve
      const matchResolve = path.match(/^\/api\/tickets\/([^\/]+)\/resolve$/);
      if (matchResolve && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const tkt = db.tickets.find(t => t.id === matchResolve[1]);
        if (tkt) {
          tkt.status = 'Resolved';
          saveMockDB(db);
        }
        return jsonResponse({ success: true });
      }

      // 8. GET /api/logbook
      if (path === '/api/logbook' && method === 'GET') {
        return jsonResponse(db.logbook);
      }

      // 9. GET /api/schools
      if (path === '/api/schools' && method === 'GET') {
        return jsonResponse(db.schools);
      }

      // 10. GET /api/classes
      if (path === '/api/classes' && method === 'GET') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        let filtered = db.classes;
        if (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.TEACHER) {
          filtered = db.classes.filter(c => c.schoolId === currentUser.schoolId);
        } else if (currentUser.role === UserRole.VOLUNTEER) {
          filtered = db.classes.filter(c => currentUser.assignedSchools?.includes(c.schoolId));
        }
        return jsonResponse(filtered);
      }

      // 11. GET /api/students
      if (path === '/api/students' && method === 'GET') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        
        let filtered = db.students;
        if (currentUser.role === UserRole.SCHOOL || currentUser.role === UserRole.TEACHER) {
          filtered = db.students.filter(s => s.schoolId === currentUser.schoolId);
        } else if (currentUser.role === UserRole.VOLUNTEER) {
          filtered = db.students.filter(s => currentUser.assignedSchools?.includes(s.schoolId));
        }

        // Mask Aadhar for non-Superadmins
        const mapped = filtered.map(s => {
          if (currentUser.role !== UserRole.SUPERADMIN) {
            return { ...s, aadharMasked: 'XXXX-XXXX-' + s.aadharMasked.slice(-4) };
          }
          return s;
        });

        return jsonResponse(mapped);
      }

      // 12. POST /api/students (Add student)
      if (path === '/api/students' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { name, age, classGroup, section, schoolId, aadharNumber } = bodyData;
        if (!name || !age || !classGroup || !section || !schoolId || !aadharNumber) {
          return errorResponse('Missing required student details.');
        }

        const cleanAadhar = aadharNumber.replace(/[^0-9]/g, '');
        const masked = `XXXX-XXXX-${cleanAadhar.slice(-4)}`;

        const newStd: Student = {
          id: 'STD_' + Math.floor(10000 + Math.random() * 90000),
          name,
          age: parseInt(age, 10),
          classGroup,
          section,
          schoolId,
          teacherId: currentUser.role === UserRole.TEACHER ? currentUser.id : undefined,
          currentLevel: 1,
          currentSubLevel: 0,
          targetLevel: 2,
          aadharMasked: masked,
          levelHistory: [],
          streak: 0
        };

        db.students.push(newStd);

        // Add to logbook
        db.logbook.unshift({
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          schoolId,
          schoolName: 'GPS',
          userId: currentUser.id,
          userEmail: currentUser.email,
          userRole: currentUser.role,
          activityType: 'verify',
          status: 'Success',
          details: `Onboarded and verified student: ${name}`
        });

        saveMockDB(db);
        return jsonResponse(newStd);
      }

      // 13. PATCH /api/students/:id (Bypass Level override)
      const matchStudentPatch = path.match(/^\/api\/students\/([^\/]+)$/);
      if (matchStudentPatch && method === 'PATCH') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const studentIndex = db.students.findIndex(s => s.id === matchStudentPatch[1]);
        if (studentIndex === -1) return errorResponse('Student not found.', 404);

        const { currentLevel, currentSubLevel, targetLevel, levelHistory } = bodyData;
        const student = db.students[studentIndex];

        if (currentLevel !== undefined) student.currentLevel = Number(currentLevel);
        if (currentSubLevel !== undefined) student.currentSubLevel = Number(currentSubLevel);
        if (targetLevel !== undefined) student.targetLevel = Number(targetLevel);
        if (levelHistory !== undefined) student.levelHistory = levelHistory;

        saveMockDB(db);
        return jsonResponse(student);
      }

      // 14. POST /api/students/:id/diagnostic
      const matchDiagGen = path.match(/^\/api\/students\/([^\/]+)\/diagnostic$/);
      if (matchDiagGen && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const student = db.students.find(s => s.id === matchDiagGen[1]);
        if (!student) return errorResponse('Student not found.', 404);

        const classMatch = student.classGroup.match(/\d+/);
        const classNum = classMatch ? parseInt(classMatch[0], 10) : 1;

        // Generate baseline questions matching their initial class
        const mockQuestions: Question[] = [];
        // Grab Level questions matching the class range:
        // Class 1 -> Levels 1, 2, 3
        // Class 2 -> Levels 1, 2, 3, 24
        // Class 3 -> Levels 2, 3, 36
        // Class 4 -> Levels 3, 4, 49
        const levelsToLoad = classNum === 1 ? [1, 2, 3] : classNum === 2 ? [1, 2, 3, 24] : classNum === 3 ? [2, 3, 36] : [3, 4, 49];
        levelsToLoad.forEach(l => {
          mockQuestions.push(...generateQuestionsForLevel(l, 0).slice(0, 1));
        });

        return jsonResponse({
          student,
          diagnosticPaper: {
            id: 'diag_' + student.id + '_' + Date.now(),
            studentId: student.id,
            studentName: student.name,
            questions: mockQuestions,
            pdfUrl: ''
          }
        });
      }

      // 15. POST /api/students/:id/diagnostic/submit
      const matchDiagSubmit = path.match(/^\/api\/students\/([^\/]+)\/diagnostic\/submit$/);
      if (matchDiagSubmit && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const student = db.students.find(s => s.id === matchDiagSubmit[1]);
        if (!student) return errorResponse('Student not found.', 404);

        const { questions, answers } = bodyData;
        const evaluation = evaluateDiagnosticMock(student.name, questions, answers);

        // Weakest-Level placement subLevel determination
        let subLevel = 0;
        const levelQuestions = questions.filter((q: any) => q.source_level === evaluation.recommendedLevel);
        if (levelQuestions.length > 0) {
          let failedCount = 0;
          levelQuestions.forEach((q: any) => {
            const submitted = (answers[q.question_id] || '').trim().toLowerCase();
            const correct = q.answer.trim().toLowerCase();
            if (submitted !== correct) {
              failedCount++;
            }
          });

          if (failedCount === levelQuestions.length) {
            subLevel = 2; // Remedial
          } else if (failedCount > 0) {
            subLevel = 1; // Easier
          } else {
            subLevel = 0; // Mastery
          }
        }

        const newHistory = [...student.levelHistory, {
          level: evaluation.recommendedLevel,
          subLevel,
          date: new Date().toISOString().split('T')[0],
          reason: 'Onboarding Diagnostic Evaluation Placement'
        }];

        student.currentLevel = evaluation.recommendedLevel;
        student.currentSubLevel = subLevel;
        student.targetLevel = Math.min(59, evaluation.recommendedLevel + 1);
        student.levelHistory = newHistory;

        // Add Evaluation Report
        const report: EvaluationReport = {
          id: 'rep_diag_' + Date.now(),
          studentId: student.id,
          worksheetId: 'diagnostic',
          score: evaluation.score,
          totalQuestions: questions.length,
          conceptMastery: {
            'Number Sense': evaluation.recommendedLevel >= 2 ? 'Strong' : 'Needs Practice',
            'Shapes': evaluation.recommendedLevel >= 3 ? 'Strong' : 'Needs Practice',
            'Fractions': evaluation.recommendedLevel >= 5 ? 'Strong' : 'Needs Practice'
          },
          narrative: evaluation.narrative,
          recommendedLevel: evaluation.recommendedLevel,
          recommendedSubLevel: subLevel,
          timestamp: new Date().toISOString()
        };

        db.evaluationReports.push(report);

        // Add to logbook
        db.logbook.unshift({
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          schoolId: student.schoolId,
          schoolName: 'GPS',
          userId: currentUser.id,
          userEmail: currentUser.email,
          userRole: currentUser.role,
          activityType: 'scan',
          status: 'Success',
          details: `Submitted and scored diagnostic for ${student.name}. Placed at L${evaluation.recommendedLevel}.${subLevel}`
        });

        saveMockDB(db);
        return jsonResponse({ student, evaluation, report });
      }

      // 16. POST /api/worksheets/generate
      if (path === '/api/worksheets/generate' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { classId, cycle } = bodyData;

        const classObj = db.classes.find(c => c.id === classId);
        if (!classObj) return errorResponse('Class not found.', 404);

        const school = db.schools.find(s => s.id === classObj.schoolId);
        if (!school) return errorResponse('School not found.', 404);

        // Enforce pairwise lockouts
        const conflicting = db.worksheets.find(w => w.classId === classId && w.cycle === cycle);
        if (conflicting && conflicting.locks.locked) {
          if (conflicting.locks.lockedByRole !== currentUser.role) {
            return errorResponse(`Lock Active: Parallel generation is locked.`, 423);
          }
        }

        const classStudents = db.students.filter(
          s => s.classGroup === classObj.className && s.section === classObj.section && s.schoolId === classObj.schoolId
        );

        if (classStudents.length === 0) {
          return errorResponse('No students found in this class roster.');
        }

        const compiledQuestions: Question[] = [];
        classStudents.forEach(student => {
          const subLvl = student.currentSubLevel || 0;
          const questionsList = generateQuestionsForLevel(student.currentLevel, subLvl);
          questionsList.forEach(q => {
            compiledQuestions.push({
              ...q,
              question_id: `${student.id}_${q.question_id}`,
              question: `[For ${student.name} - L${student.currentLevel}.${subLvl}] ${q.question}`
            });
          });
        });

        const now = new Date();
        const newWs: Worksheet = {
          id: 'WS_' + Math.floor(1000 + Math.random() * 9000),
          classId,
          className: classObj.className,
          section: classObj.section,
          schoolId: classObj.schoolId,
          generatedByRole: currentUser.role,
          generatedByEmail: currentUser.email,
          cycle,
          date: now.toISOString().split('T')[0],
          questions: compiledQuestions,
          locks: {
            locked: true,
            lockedByRole: currentUser.role,
            lockedByEmail: currentUser.email,
            timestamp: now.toISOString()
          },
          timing: {
            examDate: now.toISOString().split('T')[0],
            printWindowStart: now.toISOString(),
            printWindowEnd: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            examWindowStart: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            examWindowEnd: new Date(now.getTime() + 105 * 60 * 1000).toISOString(),
            submissionWindowEnd: new Date(now.getTime() + 165 * 60 * 1000).toISOString()
          },
          delayLogs: {
            delayedAttemptsCount: 0,
            submittingTeachers: []
          }
        };

        db.worksheets.push(newWs);
        saveMockDB(db);
        return jsonResponse(newWs);
      }

      // 17. POST /api/worksheets/generate-pdf
      if (path === '/api/worksheets/generate-pdf' && method === 'POST') {
        const { worksheetId } = bodyData;
        const ws = db.worksheets.find(w => w.id === worksheetId);
        if (!ws) return errorResponse('Worksheet not found.', 404);

        // In mock mode, simulate PDF generation by returning a virtual URL
        return jsonResponse({
          success: true,
          pdfUrl: `/output/mock_worksheet_${worksheetId}.pdf`
        });
      }

      // 18. POST /api/evaluation/submit
      if (path === '/api/evaluation/submit' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { worksheetId, studentId, answers } = bodyData;

        const ws = db.worksheets.find(w => w.id === worksheetId);
        if (!ws) return errorResponse('Worksheet not found.', 404);

        const student = db.students.find(s => s.id === studentId);
        if (!student) return errorResponse('Student not found.', 404);

        const studentQuestions = ws.questions.filter(q => q.question_id.startsWith(student.id + '_'));
        const evaluation = evaluateWorksheetMock(student.name, student.currentLevel, studentQuestions, answers);

        const now = new Date();
        const submission: AnswerSubmission = {
          id: 'sub_' + student.id + '_' + Date.now(),
          worksheetId,
          studentId,
          studentName: student.name,
          schoolId: ws.schoolId,
          classId: ws.classId,
          submittedAt: now.toISOString(),
          isDelayed: false,
          answers
        };

        db.answerSubmissions.push(submission);

        const report: EvaluationReport = {
          id: 'rep_' + student.id + '_' + Date.now(),
          studentId,
          worksheetId,
          score: evaluation.score,
          totalQuestions: studentQuestions.length,
          conceptMastery: evaluation.conceptMastery,
          narrative: evaluation.narrative,
          recommendedLevel: evaluation.recommendedLevel,
          timestamp: now.toISOString()
        };

        db.evaluationReports.push(report);

        // Update student level
        const levelHistory = [...student.levelHistory];
        if (evaluation.recommendedLevel !== student.currentLevel) {
          levelHistory.push({
            level: evaluation.recommendedLevel,
            date: now.toISOString().split('T')[0],
            reason: `Performance on ${ws.cycle} exam worksheet`
          });
        }

        student.currentLevel = evaluation.recommendedLevel;
        student.targetLevel = Math.min(59, evaluation.recommendedLevel + 1);
        student.levelHistory = levelHistory;
        student.streak = student.streak + 1;

        db.logbook.unshift({
          id: 'log_' + Date.now(),
          timestamp: now.toISOString(),
          schoolId: ws.schoolId,
          schoolName: 'GPS',
          userId: currentUser.id,
          userEmail: currentUser.email,
          userRole: currentUser.role,
          activityType: 'scan',
          status: 'Success',
          details: `Graded worksheet student ${student.name}. Score: ${evaluation.score}/${studentQuestions.length}`
        });

        saveMockDB(db);
        return jsonResponse({ submission, report, evaluation });
      }

      // 18. GET /api/evaluation/:studentId/history
      const matchHistory = path.match(/^\/api\/evaluation\/([^\/]+)\/history$/);
      if (matchHistory && method === 'GET') {
        const filtered = db.evaluationReports.filter(r => r.studentId === matchHistory[1]);
        return jsonResponse(filtered);
      }

      // 19. GET /api/analytics
      if (path === '/api/analytics' && method === 'GET') {
        // Compute comprehensive geo-scoped analytics matching server format
        const totalEnrolled = db.students.length;
        const certifiedCount = db.students.filter(s => s.currentLevel >= 5).length;
        const certificationPercent = totalEnrolled > 0 ? Math.round((certifiedCount / totalEnrolled) * 100) : 0;

        const getScopeMetrics = (filteredStudents: typeof db.students) => {
          const count = filteredStudents.length;
          if (count === 0) {
            return {
              avgLevel: 0,
              certificationRate: 0,
              topicMastery: {
                "Number Sense": 0, "Number Operations": 0, "Shapes": 0,
                "Fractions": 0, "Patterns": 0, "Measurement": 0
              },
              levelDistribution: Object.fromEntries(
                Array.from({ length: 15 }, (_, i) => [`Level ${i + 1}`, 0])
                  .concat([["Level 16+", 0]])
              )
            };
          }
          const sumLevel = filteredStudents.reduce((acc: number, s: any) => acc + s.currentLevel, 0);
          const avgLevel = Math.round((sumLevel / count) * 10) / 10;
          const certified = filteredStudents.filter((s: any) => s.currentLevel >= 5).length;
          const certificationRate = Math.round((certified / count) * 100);

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

          return { avgLevel, certificationRate, topicMastery, levelDistribution };
        };

        const studentsWithGeo = db.students.map((s: any) => {
          const sch = db.schools.find((x: any) => x.id === s.schoolId);
          return { ...s, stateCode: sch?.stateCode || '', districtCode: sch?.districtCode || '', blockCode: sch?.blockCode || '' };
        });

        const stateCodeParam = (new URL(url, window.location.origin)).searchParams.get('stateCode') || 'PB';
        const districtCodeParam = (new URL(url, window.location.origin)).searchParams.get('districtCode') || 'LDH';
        const blockCodeParam = (new URL(url, window.location.origin)).searchParams.get('blockCode') || 'LDH-01';

        const national = getScopeMetrics(studentsWithGeo);
        const state = getScopeMetrics(studentsWithGeo.filter((s: any) => s.stateCode === stateCodeParam));
        const district = getScopeMetrics(studentsWithGeo.filter((s: any) => s.districtCode === districtCodeParam));
        const block = getScopeMetrics(studentsWithGeo.filter((s: any) => s.blockCode === blockCodeParam));

        return jsonResponse({
          totalStudents: db.students.length,
          totalSchools: db.schools.length,
          certificationPercent,
          national,
          state,
          district,
          block,
          roleScope: currentUser?.role || 'superadmin'
        });
      }

      // 20. GET /api/admin/coordinators
      if (path === '/api/admin/coordinators' && method === 'GET') {
        return jsonResponse(db.users);
      }

      // 21. POST /api/admin/create
      if (path === '/api/admin/create' && method === 'POST') {
        if (!currentUser) return errorResponse('Unauthorized', 401);
        const { email, name, role, stateCode, districtCode, blockCode } = bodyData;
        
        const newU = {
          id: 'u_' + Math.random().toString(36).substr(2, 9),
          email,
          name,
          role,
          stateCode,
          districtCode,
          blockCode
        };
        db.users.push(newU);
        saveMockDB(db);
        return jsonResponse(newU);
      }

      // 22. POST /api/admin/revive-teacher
      if (path === '/api/admin/revive-teacher' && method === 'POST') {
        const { email } = bodyData;
        const teacher = db.users.find(u => u.email === email);
        if (teacher) {
          teacher.delayedAttemptsCount = 0;
          teacher.isBanned = false;
          saveMockDB(db);
        }
        return jsonResponse({ success: true });
      }

      // 23. POST /api/admin/restore-school
      if (path === '/api/admin/restore-school' && method === 'POST') {
        const { schoolId } = bodyData;
        const school = db.schools.find(s => s.id === schoolId);
        if (school) {
          school.isAccessLocked = false;
          saveMockDB(db);
        }
        return jsonResponse({ success: true });
      }

      // 24. POST /api/reset
      if (path === '/api/reset' && method === 'POST') {
        const seed = getInitialSeedData();
        saveMockDB(seed);
        return jsonResponse({ success: true, message: 'Database reset successfully.' });
      }

      // Fallback
      return originalFetch(input, init);

    } catch (e: any) {
      console.error('[Mock Fetch Error]', e);
      return errorResponse(e.message || 'Internal Server Mock Error');
    }
  };
}
