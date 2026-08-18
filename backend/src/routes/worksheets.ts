import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, Student, Question, Worksheet, LevelWorksheet } from '../db';
import { getAuthUser } from '../auth';
import { generateQuestionsForLevel } from '../levelGenerator';
import * as levelsBackendClient from '../levelsBackendClient';
import { ROOT_DIR } from '../config';

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
      targetLevel: s.targetLevel
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

export function registerWorksheetRoutes(app: express.Express) {
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
      const { renderWorksheetPdf } = await import('../paperGenerator');
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
        const { generateLevelWorksheet } = await import('../paperGenerator');
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
}
