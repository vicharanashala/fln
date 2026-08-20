import express from 'express';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, Question, Worksheet } from '../db';
import { getAuthUser } from '../auth';
import { generateDiagnosticPaper } from '../paperGenerator';
import { generateQuestionsForLevel } from '../levelGenerator';

export function registerDiagnosticBulkRoutes(app: express.Express) {
  // Get active coordinators/administrators
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

        // Persist a real Worksheet record so this generation shows up as
        // "Pending" on the teacher's Worksheets page until evaluation
        // reports come in — previously this bulk-generation job only lived
        // in the in-memory `bulkJobs` map, invisible to that page entirely.
        // Scope by the requesting user's own school first — className alone
        // matches nationally (e.g. every "Class 2" in every school), which
        // would attach this worksheet to a same-named class in a different
        // school entirely.
        const matchedClass = classes.find(c => c.className === `Class ${classNumber}` && c.schoolId === user.schoolId)
          || classes.find(c => c.className === `Class ${classNumber}`);
        const nowIso = new Date().toISOString();
        const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const realStudentIds = paperStudents
          .map(s => s.studentId)
          .filter(id => id && !id.startsWith('PLACEHOLDER_'));
        const worksheet: Worksheet = {
          id: 'ws_' + randomUUID(),
          classId: matchedClass?.id || `class_${classNumber}`,
          className: `Class ${classNumber}`,
          section: matchedClass?.section || 'A',
          schoolId: user.schoolId || matchedClass?.schoolId || '',
          generatedByRole: user.role,
          generatedByEmail: user.email,
          cycle: 'Baseline',
          date: nowIso,
          questions: [],
          studentIds: realStudentIds,
          locks: { locked: false, lockedByRole: null, lockedByEmail: null, timestamp: null },
          timing: {
            examDate: nowIso.slice(0, 10),
            printWindowStart: nowIso,
            printWindowEnd: thirtyDaysOut,
            examWindowStart: nowIso,
            examWindowEnd: thirtyDaysOut,
            submissionWindowEnd: thirtyDaysOut,
          },
          delayLogs: { delayedAttemptsCount: 0, submittingTeachers: [] },
        };
        await dbStore.addWorksheet(worksheet);

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
              currentSubLevel: student.currentSubLevel, targetLevel: student.targetLevel
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
}
