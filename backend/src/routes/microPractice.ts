import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, Question, PracticeSchedule, MicroAssignment, UploadedPaper } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { getStrandForLevel } from '../flnLevels';
import { getOrInitPracticeSchedule, normalizeCompetencyName, calculateNextScheduleState } from '../services/practiceScheduleService';
import { ROOT_DIR } from '../config';

// Adaptive Micro-Practice & Spaced-Repetition: paper generation (single-
// competency, multi-competency, and bulk), upload/grading, and the due/
// progress/history views that drive the teacher-facing practice workflow.

// Shared logic for weak-competency lookup — used by both
// GET /api/students/:id/weak-competencies (single-student UI lookup) and
// POST /api/practice/bulk-generate (class-wide generation, below).
async function getWeakCompetenciesForStudent(studentId: string) {
  const reports = await dbStore.getEvaluationReports();
  const studentReports = reports
    .filter(r => r.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (studentReports.length === 0) {
    return { hasEvaluationData: false, weakCompetencies: [] as string[], fullMastery: undefined as any, latestReportDate: null as string | null };
  }

  const latest = studentReports[0];
  const weak = Array.from(new Set(
    Object.entries(latest.conceptMastery || {})
      .filter(([_, status]) => status === 'Needs Practice')
      .map(([topic]) => normalizeCompetencyName(topic))
  ));

  return {
    hasEvaluationData: true,
    weakCompetencies: weak,
    fullMastery: latest.conceptMastery,
    latestReportDate: latest.timestamp
  };
}

// Resolves each competency to the student's real levelId/subIdx (via
// getOrInitPracticeSchedule), splitting out already-mastered ones. Shared
// by the multi-competency and bulk-generate routes.
async function resolveCompetencyLevels(
  studentId: string, studentName: string, teacherId: string, competencies: string[]
): Promise<{ resolved: { competency: string; levelId: number; subIdx: number }[]; masteredCompetencies: string[] }> {
  const resolved: { competency: string; levelId: number; subIdx: number }[] = [];
  const masteredCompetencies: string[] = [];
  for (const competency of competencies) {
    const schedule = await getOrInitPracticeSchedule(studentId, studentName, teacherId, competency);
    if (schedule.resolved) {
      masteredCompetencies.push(competency);
      continue;
    }
    resolved.push({ competency, levelId: schedule.currentLevelId!, subIdx: schedule.currentSubIdx || 0 });
  }
  return { resolved, masteredCompetencies };
}

// IST has no DST, so a fixed +5:30 offset is exact. Returns the UTC instant
// for 00:00 IST on (fromDate + intervalDays).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function nextDueDateIST(fromDate: Date, intervalDays: number): Date {
  const istNow = new Date(fromDate.getTime() + IST_OFFSET_MS);
  const istMidnightTarget = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate() + intervalDays
  );
  return new Date(istMidnightTarget - IST_OFFSET_MS);
}

interface MicroBulkJob {
  jobId: string;
  total: number;
  completed: number;
  status: 'running' | 'completed' | 'failed';
  results: any[];
  combinedPdfUrl: string | null;
  zipUrl: string | null;
  error: string;
}

const microBulkJobs = new Map<string, MicroBulkJob>();

export function registerMicroPracticeRoutes(app: express.Express) {
  // Weak competencies for one student, derived from their most recent
  // evaluation report's conceptMastery breakdown. Used by the generate-paper
  // form to scope the competency dropdown to the student's actual weak areas.
  app.get('/api/students/:id/weak-competencies', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    res.json(await getWeakCompetenciesForStudent(req.params.id));
  });

  // Generates a single-section micro-practice PDF — distinct from
  // /api/worksheets/generate-level-pdf's full multi-section worksheet.
  app.post('/api/students/:id/micro-practice/generate-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { competency, sectionIndex, questionCount, levelId: overrideLevelId, subIdx: overrideSubIdx } = req.body;
    if (sectionIndex == null || questionCount == null) {
      return res.status(400).json({ error: 'sectionIndex and questionCount are required.' });
    }
    if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1) {
      return res.status(400).json({ error: 'questionCount must be a positive integer.' });
    }

    // competency: resolved from the student's PracticeSchedule (adaptive,
    // blocked once resolved). levelId+subIdx: manual override, bypassing the schedule entirely.
    let levelId: number, subIdx: number;
    if (overrideLevelId != null && overrideSubIdx != null) {
      levelId = Number(overrideLevelId);
      subIdx = Number(overrideSubIdx);
    } else {
      if (!competency) {
        return res.status(400).json({ error: 'competency is required (or supply levelId and subIdx directly to override the schedule).' });
      }
      let schedule: PracticeSchedule;
      try {
        schedule = await getOrInitPracticeSchedule(student.id, student.name, user.id, competency);
      } catch (err: any) {
        return res.status(400).json({ error: err.message });
      }
      if (schedule.resolved) {
        return res.status(409).json({ error: `${competency} is fully mastered for this student — no further levels available.` });
      }
      levelId = schedule.currentLevelId!;
      subIdx = schedule.currentSubIdx || 0;
    }

    try {
      const { generateMicroPracticePaper } = await import('../paperGenerator');
      const result = await generateMicroPracticePaper({
        studentId: student.id,
        studentName: student.name,
        studentClass: `${student.classGroup} - ${student.section}`,
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: Number(questionCount)
      });

      // Persist the real answer key so it can be looked up by paperId later,
      // instead of re-running generateMicroSet (which would randomize differently).
      await dbStore.addMicroPracticePaper({
        id: result.paperId,
        studentId: student.id,
        studentName: student.name,
        competency: getStrandForLevel(levelId),
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: result.questions.length,
        questions: result.questions,
        pdfUrl: result.pdfUrl,
        createdAt: new Date().toISOString()
      });

      res.json({ success: true, pdfUrl: result.pdfUrl, paperId: result.paperId, levelId, subIdx });
    } catch (err: any) {
      console.error('Micro-practice PDF generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generates ONE combined PDF covering multiple weak competencies — distinct
  // from generate-pdf above, which covers exactly one competency per paper.
  app.post('/api/students/:id/micro-practice/generate-multi-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { competencies, questionsPerCompetency } = req.body;
    if (!Array.isArray(competencies) || competencies.length === 0) {
      return res.status(400).json({ error: 'competencies must be a non-empty array.' });
    }
    if (!Number.isInteger(Number(questionsPerCompetency)) || Number(questionsPerCompetency) < 1) {
      return res.status(400).json({ error: 'questionsPerCompetency must be a positive integer.' });
    }

    try {
      const { resolved, masteredCompetencies } = await resolveCompetencyLevels(
        student.id, student.name, user.id, competencies
      );
      if (resolved.length === 0) {
        return res.status(409).json({
          error: `All requested competencies (${masteredCompetencies.join(', ')}) are fully mastered for this student — no further levels available.`
        });
      }

      const { generateMultiCompetencyMicroPaper } = await import('../paperGenerator');
      const result = await generateMultiCompetencyMicroPaper({
        studentId: student.id,
        studentName: student.name,
        studentClass: `${student.classGroup} - ${student.section}`,
        competencyLevels: resolved,
        questionsPerCompetency: Number(questionsPerCompetency)
      });

      await dbStore.addMicroPracticePaper({
        id: result.paperId,
        studentId: student.id,
        studentName: student.name,
        pdfUrl: result.pdfUrl,
        createdAt: new Date().toISOString(),
        parts: result.parts
      });

      res.json({
        success: true,
        pdfUrl: result.pdfUrl,
        paperId: result.paperId,
        ...(masteredCompetencies.length ? { skippedMasteredCompetencies: masteredCompetencies } : {})
      });
    } catch (err: any) {
      console.error('Multi-competency micro-practice PDF generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generates a multi-competency paper per student in one action; a missing/
  // forbidden/failing student is skipped, not fatal. Runs as a background job (like /api/diagnostic/bulk), polled via progress below.
  app.post('/api/practice/bulk-generate', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentIds, questionsPerCompetency, studentCompetencyOverrides } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds must be a non-empty array.' });
    }
    if (!Number.isInteger(Number(questionsPerCompetency)) || Number(questionsPerCompetency) < 1) {
      return res.status(400).json({ error: 'questionsPerCompetency must be a positive integer.' });
    }

    const jobId = 'microbulk_' + randomUUID();
    const job: MicroBulkJob = {
      jobId,
      total: studentIds.length,
      completed: 0,
      status: 'running',
      results: [],
      combinedPdfUrl: null,
      zipUrl: null,
      error: ''
    };
    microBulkJobs.set(jobId, job);

    // Run in background — the response below is sent immediately, before
    // any student's paper has been generated.
    (async () => {
      try {
        const students = await dbStore.getStudents();
        const generatedFiles: { studentId: string; studentName: string; filePath: string }[] = [];

        for (const studentId of studentIds) {
          const student = students.find(s => s.id === studentId);
          if (!student) {
            job.results.push({ studentId, studentName: null, skipped: true, reason: 'Student not found.' });
            job.completed++;
            continue;
          }
          if (!canAccessStudent(user, student)) {
            job.results.push({ studentId, studentName: student.name, skipped: true, reason: 'Forbidden.' });
            job.completed++;
            continue;
          }

          try {
            // A caller-supplied override takes the exact competency list as
            // given; the "not yet diagnosed" skip below only applies to the fallback weak-competency list.
            const overrideCompetencies = studentCompetencyOverrides?.[studentId];
            let competencies: string[];
            if (Array.isArray(overrideCompetencies) && overrideCompetencies.length > 0) {
              competencies = overrideCompetencies;
            } else {
              const weakData = await getWeakCompetenciesForStudent(studentId);
              if (!weakData.weakCompetencies || weakData.weakCompetencies.length === 0) {
                job.results.push({ studentId, studentName: student.name, skipped: true, reason: 'Not yet diagnosed' });
                job.completed++;
                continue;
              }
              competencies = weakData.weakCompetencies;
            }

            const { resolved, masteredCompetencies } = await resolveCompetencyLevels(
              student.id, student.name, user.id, competencies
            );
            if (resolved.length === 0) {
              job.results.push({
                studentId, studentName: student.name, skipped: true,
                reason: `All weak competencies (${masteredCompetencies.join(', ')}) are fully mastered.`
              });
              job.completed++;
              continue;
            }

            const { generateMultiCompetencyMicroPaper } = await import('../paperGenerator');
            const result = await generateMultiCompetencyMicroPaper({
              studentId: student.id,
              studentName: student.name,
              studentClass: `${student.classGroup} - ${student.section}`,
              competencyLevels: resolved,
              questionsPerCompetency: Number(questionsPerCompetency)
            });

            await dbStore.addMicroPracticePaper({
              id: result.paperId,
              studentId: student.id,
              studentName: student.name,
              pdfUrl: result.pdfUrl,
              createdAt: new Date().toISOString(),
              parts: result.parts
            });

            job.results.push({ studentId, studentName: student.name, skipped: false, pdfUrl: result.pdfUrl, paperId: result.paperId });
            generatedFiles.push({ studentId: student.id, studentName: student.name, filePath: result.filePath });
          } catch (err: any) {
            console.error(`Bulk micro-practice generation failed for student ${studentId}:`, err);
            job.results.push({ studentId, studentName: student.name, skipped: true, reason: err.message || 'Generation failed.' });
          }
          job.completed++;
        }

        if (generatedFiles.length > 0) {
          try {
            const { mergeMicroPracticePdfs, zipMicroPracticePdfs } = await import('../paperGenerator');
            const merged = await mergeMicroPracticePdfs(generatedFiles.map(f => f.filePath));
            job.combinedPdfUrl = merged.pdfUrl;

            const zipped = await zipMicroPracticePdfs(generatedFiles.map(f => ({
              fileName: `${f.studentName.replace(/\s+/g, '_')}_${f.studentId}.pdf`,
              filePath: f.filePath
            })));
            job.zipUrl = zipped.zipUrl;
          } catch (err: any) {
            console.error('Bulk combined PDF/ZIP creation failed:', err);
          }
        }

        job.status = 'completed';
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Unknown error during bulk generation.';
        console.error('Micro-practice bulk job failed:', err);
      }
    })();

    res.status(202).json({
      jobId,
      total: job.total,
      status: 'running',
      progressUrl: `/api/practice/bulk-generate/${jobId}/progress`
    });
  });

  // Poll a bulk-generation job; results/combinedPdfUrl/zipUrl come back
  // directly once 'completed' — no separate download route needed since outputs are already static-served.
  app.get('/api/practice/bulk-generate/:jobId/progress', (req, res) => {
    const job = microBulkJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    res.json({
      jobId: job.jobId,
      total: job.total,
      completed: job.completed,
      status: job.status,
      results: job.results,
      combinedPdfUrl: job.combinedPdfUrl,
      zipUrl: job.zipUrl,
      error: job.error
    });
  });

  // Looks up a paper's real answer key by paperId, rather than re-running
  // generateMicroSet, which is unseeded and would produce different questions.
  app.get('/api/practice/paper/:paperId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const paper = await dbStore.getMicroPracticePaperById(req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Micro-practice paper not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === paper.studentId);
    if (student && !canAccessStudent(user, student)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    // Merge in any saved draft answers from the matching UploadedPaper record
    // (a different collection, keyed by the same paperId) so the answer-entry
    // screen can pre-fill a partially-completed session.
    const uploadedPaper = await dbStore.getUploadedPaperByPaperId(req.params.paperId);
    res.json({ ...paper, draftAnswers: uploadedPaper?.draftAnswers });
  });

  // Saves in-progress ungraded answers so a teacher can resume later; doesn't
  // touch gradingStatus — this is a draft, not a submission.
  app.patch('/api/practice/paper/:paperId/save-draft', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers is required.' });
    }

    const uploadedPaper = await dbStore.getUploadedPaperByPaperId(req.params.paperId);
    if (!uploadedPaper) return res.status(404).json({ error: 'Uploaded paper not found.' });

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === uploadedPaper.studentId);
    if (student && !canAccessStudent(user, student)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    await dbStore.updateUploadedPaper(uploadedPaper.id, { draftAnswers: answers });
    res.json({ success: true });
  });

  // Pre-flight check for client-decoded paperIds: reports which already have
  // an UploadedPaper record, and whether it's 'pending' (offer replace) or 'graded' (skip). Scoped like the upload route itself.
  app.post('/api/practice/upload-paper/check-duplicates', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { paperIds } = req.body;
    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ error: 'paperIds must be a non-empty array.' });
    }

    const [existing, students] = await Promise.all([
      dbStore.getUploadedPapersByPaperIds(paperIds),
      dbStore.getStudents()
    ]);

    const duplicates = existing
      .filter(p => {
        const student = students.find(s => s.id === p.studentId);
        return !!student && canAccessStudent(user, student);
      })
      .map(p => ({
        paperId: p.paperId,
        studentName: p.studentName,
        status: p.gradingStatus,
        uploadedPaperId: p.id
      }));

    res.json({ duplicates });
  });

  // Stores an uploaded photo; the frontend already decoded the QR, so this
  // just persists an UploadedPaper record ('pending') for later grading.
  // replaceUploadedPaperId updates an existing pending duplicate in place instead of inserting a second row.
  app.post('/api/practice/upload-paper', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageBase64, imageBase64s, filename, paperId, studentId, studentName, levelId, subIdx, sectionIndex, questionCount, uploadBatchId, replaceUploadedPaperId } = req.body;
    const images: string[] = Array.isArray(imageBase64s) && imageBase64s.length > 0
      ? imageBase64s
      : (imageBase64 ? [imageBase64] : []);
    if (images.length === 0) {
      return res.status(400).json({ error: 'imageBase64 or imageBase64s is required.' });
    }

    if (studentId) {
      const students = await dbStore.getStudents();
      const student = students.find(s => s.id === studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });
    }

    // Re-check the replace target's status right before writing — it may
    // have been graded in the gap since the check-duplicates call.
    let replaceTarget: UploadedPaper | undefined;
    if (replaceUploadedPaperId) {
      replaceTarget = await dbStore.getUploadedPaperById(replaceUploadedPaperId);
      if (!replaceTarget) {
        return res.status(404).json({ error: 'The paper to replace no longer exists.' });
      }
      if (replaceTarget.gradingStatus !== 'pending') {
        return res.status(409).json({ error: 'This paper has already been graded and can no longer be replaced.' });
      }
    }

    try {
      const uploadsDir = path.join(ROOT_DIR, 'output', 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });

      const safeStudentPart = studentId ? `_${String(studentId).replace(/[^a-zA-Z0-9_-]+/g, '')}` : '';
      let savedFileName: string;
      let savedFilePath: string;

      if (images.length > 1) {
        // Multiple page images belonging to one paper (a multi-page scan,
        // all sharing the same paperId QR) — merge into a single PDF so
        // nothing beyond page 1 is lost.
        const { mergeImagesIntoPdf } = await import('../paperGenerator');
        const mergedBuffer = await mergeImagesIntoPdf(images);
        savedFileName = `paper${safeStudentPart}_${randomUUID()}.pdf`;
        savedFilePath = path.join(uploadsDir, savedFileName);
        fs.writeFileSync(savedFilePath, mergedBuffer);
      } else {
        const ext = path.extname(filename || 'paper.jpg') || '.jpg';
        savedFileName = `paper${safeStudentPart}_${randomUUID()}${ext}`;
        savedFilePath = path.join(uploadsDir, savedFileName);
        const cleanBase64 = images[0].includes(',') ? images[0].split(',')[1] : images[0];
        fs.writeFileSync(savedFilePath, Buffer.from(cleanBase64, 'base64'));
      }

      const imageUrl = `/output/uploads/${savedFileName}`;

      let uploadedPaperId: string | null = null;
      if (replaceTarget) {
        // Replace in place, keeping id/uploadedAt/uploadBatchId; best-effort
        // delete of the old image file (non-fatal if it fails).
        await dbStore.updateUploadedPaper(replaceTarget.id, {
          imageUrl,
          studentName: studentName || replaceTarget.studentName
        });
        uploadedPaperId = replaceTarget.id;
        try {
          const oldFilePath = path.join(ROOT_DIR, replaceTarget.imageUrl.replace(/^\//, ''));
          fs.unlinkSync(oldFilePath);
        } catch (unlinkErr) {
          console.warn('Failed to delete replaced paper image (non-fatal):', unlinkErr);
        }
      } else if (paperId && studentId) {
        const sourcePaper = await dbStore.getMicroPracticePaperById(paperId);
        const totalParts = sourcePaper?.parts?.length || 1;
        const uploadedPaper: UploadedPaper = {
          id: 'upl_' + randomUUID().slice(0, 8),
          paperId,
          studentId,
          studentName: studentName || '',
          imageUrl,
          teacherId: user.id,
          uploadedAt: new Date().toISOString(),
          ...(uploadBatchId ? { uploadBatchId } : {}),
          gradingStatus: 'pending',
          totalParts,
          gradedCompetencies: []
        };
        await dbStore.addUploadedPaper(uploadedPaper);
        uploadedPaperId = uploadedPaper.id;
      }

      res.json({
        success: true,
        imageUrl,
        uploadedPaperId,
        paperId: paperId || null,
        studentId: studentId || null,
        studentName: studentName || null,
        levelId: levelId != null ? Number(levelId) : null,
        subIdx: subIdx != null ? Number(subIdx) : null,
        sectionIndex: sectionIndex != null ? Number(sectionIndex) : null,
        questionCount: questionCount != null ? Number(questionCount) : null,
        competency: levelId != null ? getStrandForLevel(Number(levelId)) : null
      });
    } catch (err: any) {
      // Not every thrower here is an Error — pdf-lib's embed calls throw
      // plain strings, which have no .message and would otherwise silently
      // drop the error out of the JSON response, leaving the teacher with
      // no explanation at all.
      const message = err instanceof Error ? err.message : String(err);
      console.error('Micro-practice paper upload failed:', err);
      res.status(500).json({ success: false, error: message });
    }
  });

  app.post('/api/practice/generate/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user || user.role !== UserRole.TEACHER) {
      return res.status(403).json({ error: 'Only teachers can generate practice assignments.' });
    }

    const { competency, sectionIndex, questionCount } = req.body;
    if (!competency) return res.status(400).json({ error: 'competency is required.' });
    if (sectionIndex == null || questionCount == null) {
      return res.status(400).json({ error: 'sectionIndex and questionCount are required.' });
    }
    if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1) {
      return res.status(400).json({ error: 'questionCount must be a positive integer.' });
    }

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Resolve the student's real, adaptive Micro-Practice position for this
    // competency — same schedule lookup /generate-pdf uses — instead of a
    // fixed window around student.currentLevel.
    let schedule: PracticeSchedule;
    try {
      schedule = await getOrInitPracticeSchedule(student.id, student.name, user.id, competency);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
    if (schedule.resolved) {
      return res.status(409).json({ error: `${competency} is fully mastered for this student — no further levels available.` });
    }
    const levelId = schedule.currentLevelId!;
    const subIdx = schedule.currentSubIdx || 0;

    try {
      const { generateMicroPracticePaper } = await import('../paperGenerator');
      const result = await generateMicroPracticePaper({
        studentId: student.id,
        studentName: student.name,
        studentClass: `${student.classGroup} - ${student.section}`,
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: Number(questionCount)
      });

      // Persist the same MicroPracticePaper record the print flow creates, so
      // this on-screen session's paperId is a real, later-lookup-able paper
      // (/api/practice/paper/:paperId) rather than a dangling id.
      await dbStore.addMicroPracticePaper({
        id: result.paperId,
        studentId: student.id,
        studentName: student.name,
        competency: getStrandForLevel(levelId),
        levelId,
        subIdx,
        sectionIndex: Number(sectionIndex),
        questionCount: result.questions.length,
        questions: result.questions,
        pdfUrl: result.pdfUrl,
        createdAt: new Date().toISOString()
      });

      res.json({
        studentId: student.id,
        studentName: student.name,
        competency,
        questions: result.questions,
        paperId: result.paperId,
        levelId,
        subIdx
      });
    } catch (err: any) {
      console.error('Micro-practice generation failed:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // List practice items due today or overdue, scoped to the requesting
  // teacher's own students (schedule.teacherId).
  app.get('/api/practice/due', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const schedules = await dbStore.getPracticeSchedules();
    const now = new Date();

    let scoped = schedules;
    if (user.role === UserRole.TEACHER) {
      scoped = schedules.filter(s => s.teacherId === user.id);
    }
    // Admins/Superadmin see everything; other roles get nothing by default
    // (this feature is teacher-driven, matching the Intervention pattern).
    else if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN, UserRole.SCHOOL].includes(user.role)) {
      scoped = [];
    }

    let due = scoped.filter(s => !s.resolved && new Date(s.nextDueDate) <= now);
    if (due.length === 0) return res.json(due);

    // Exclude (studentId, competency) pairs that already have a pending,
    // ungraded uploaded paper covering that competency — generating a new
    // paper for it doesn't make sense while one is already awaiting grading.
    const relevantStudentIds = new Set(due.map(s => s.studentId));
    const uploadedPapers = await dbStore.getUploadedPapers();
    const pendingUploads = uploadedPapers.filter(p => p.gradingStatus === 'pending' && relevantStudentIds.has(p.studentId));

    if (pendingUploads.length > 0) {
      const papers = await dbStore.getMicroPracticePapersByIds(pendingUploads.map(p => p.paperId));
      const paperById = new Map(papers.map(p => [p.id, p]));

      const outstandingKeys = new Set<string>();
      for (const up of pendingUploads) {
        const paper = paperById.get(up.paperId);
        if (!paper) continue;
        const competencies = paper.parts?.length ? paper.parts.map(pt => pt.competency) : (paper.competency ? [paper.competency] : []);
        for (const comp of competencies) {
          if (!comp || up.gradedCompetencies.includes(comp)) continue;
          outstandingKeys.add(`${up.studentId}::${comp}`);
        }
      }

      due = due.filter(s => !outstandingKeys.has(`${s.studentId}::${s.competency}`));
    }

    res.json(due);
  });

  app.post('/api/practice/submit', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, competency, questions, answers, paperId } = req.body;
    if (!studentId || !competency || !Array.isArray(questions) || !answers) {
      return res.status(400).json({ error: 'studentId, competency, questions, and answers are required.' });
    }

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // Reject re-grading a competency already graded for this paper — otherwise
    // a resubmit would double-advance the schedule for work already counted.
    if (paperId) {
      const existingUploadedPaper = await dbStore.getUploadedPaperByPaperId(paperId);
      if (existingUploadedPaper?.gradedCompetencies.includes(competency)) {
        return res.status(409).json({ error: `This competency (${competency}) has already been graded for this paper.` });
      }
    }

    // Usually a no-op find (generation already created/backfilled it); kept
    // for paperless/legacy submissions that skipped a generate call.
    let schedule: PracticeSchedule;
    try {
      schedule = await getOrInitPracticeSchedule(studentId, student.name, user.id, competency);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    // Grade the submitted answers against the questions passed back to us.
    let correctCount = 0;
    questions.forEach((q: Question) => {
      const submitted = (answers[q.question_id] || '').trim().toLowerCase();
      if (q.answer_type === 'visual-confirm') {
        if (submitted === 'yes') correctCount++;
        return;
      }
      const correct = q.answer.trim().toLowerCase();
      if (submitted === correct) correctCount++;
    });

    const now = new Date().toISOString();

    // Prior attempts for this student+competency, newest-first, for the
    // interval's history-based factor — fetched before this attempt is added.
    const priorAssignments = (await dbStore.getMicroAssignments())
      .filter(a => a.studentId === studentId && a.competency === competency && a.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 2);
    const recentScorePercents = priorAssignments.map(a =>
      a.totalCount > 0 ? ((a.correctCount || 0) / a.totalCount) * 100 : 0
    );

    const assignment: MicroAssignment = {
      id: 'ma_' + randomUUID().slice(0, 8),
      scheduleId: schedule.id,
      studentId,
      studentName: student.name,
      competency,
      questions,
      assignedAt: now,
      completedAt: now,
      correctCount,
      totalCount: questions.length
    };
    await dbStore.addMicroAssignment(assignment);

    // schedule.currentLevelId is guaranteed set — getOrInitPracticeSchedule
    // above never returns a schedule without one.
    const nextState = calculateNextScheduleState(
      schedule.intervalDays,
      schedule.currentLevelId!,
      schedule.currentSubIdx || 0,
      correctCount,
      questions.length,
      recentScorePercents
    );
    const nextDue = nextDueDateIST(new Date(), nextState.intervalDays);
    await dbStore.updatePracticeSchedule(schedule.id, {
      intervalDays: nextState.intervalDays,
      currentLevelId: nextState.levelId,
      currentSubIdx: nextState.subIdx,
      resolved: nextState.resolved,
      nextDueDate: nextDue.toISOString(),
      lastCompletedAt: now
    });

    // Only flip gradingStatus to 'graded' once every part is submitted — a
    // multi-competency paper shouldn't drop off pending after just one part.
    if (paperId) {
      const uploadedPaper = await dbStore.getUploadedPaperByPaperId(paperId);
      if (uploadedPaper && uploadedPaper.gradingStatus !== 'graded') {
        const gradedCompetencies = uploadedPaper.gradedCompetencies.includes(competency)
          ? uploadedPaper.gradedCompetencies
          : [...uploadedPaper.gradedCompetencies, competency];
        const isFullyGraded = gradedCompetencies.length >= uploadedPaper.totalParts;
        await dbStore.updateUploadedPaper(uploadedPaper.id, {
          gradedCompetencies,
          ...(isFullyGraded ? { gradingStatus: 'graded' as const, gradedAt: now } : {})
        });
      }
    }

    res.json({
      success: true,
      correctCount,
      totalCount: questions.length,
      scorePercent: Math.round((correctCount / questions.length) * 100)
    });
  });

  // Uploaded-but-ungraded papers, scoped like /api/practice/due: teachers see
  // their own, admin-tier roles see all, others get nothing.
  app.get('/api/practice/pending-papers', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const uploadedPapers = await dbStore.getUploadedPapers();

    let scoped = uploadedPapers;
    if (user.role === UserRole.TEACHER) {
      scoped = uploadedPapers.filter(p => p.teacherId === user.id);
    } else if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DISTRICT_ADMIN, UserRole.BLOCK_ADMIN, UserRole.SCHOOL].includes(user.role)) {
      scoped = [];
    }

    const pending = scoped.filter(p => p.gradingStatus === 'pending');
    res.json(pending);
  });

  // Groups completed micro-assignments by (studentId, competency), latest
  // score + attempt count each — powers "Student Progress", not due-today.
  app.get('/api/practice/progress', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const assignments = await dbStore.getMicroAssignments();
    const completed = assignments.filter(a => a.completedAt);

    // Scope to the teacher's own students where relevant, matching the
    // existing pattern used for /api/practice/due.
    const schedules = await dbStore.getPracticeSchedules();
    let scopedScheduleIds: Set<string> | null = null;
    if (user.role === UserRole.TEACHER) {
      scopedScheduleIds = new Set(schedules.filter(s => s.teacherId === user.id).map(s => s.id));
    }

    const scopedCompleted = scopedScheduleIds
      ? completed.filter(a => scopedScheduleIds!.has(a.scheduleId))
      : completed;

    // Group by studentId -> competency -> list of attempts (chronological)
    const grouped: Record<string, Record<string, any[]>> = {};
    for (const a of scopedCompleted) {
      if (!grouped[a.studentId]) grouped[a.studentId] = {};
      if (!grouped[a.studentId][a.competency]) grouped[a.studentId][a.competency] = [];
      grouped[a.studentId][a.competency].push({
        id: a.id,
        completedAt: a.completedAt,
        correctCount: a.correctCount || 0,
        totalCount: a.totalCount,
        scorePercent: a.totalCount > 0 ? Math.round(((a.correctCount || 0) / a.totalCount) * 100) : 0
      });
    }

    // Build the response: one entry per student, with a list of competencies,
    // each showing its latest score and total attempt count.
    const result = Object.entries(grouped).map(([studentId, competencies]) => {
      const studentName = scopedCompleted.find(a => a.studentId === studentId)?.studentName || 'Unknown';
      const competencyList = Object.entries(competencies).map(([competency, attempts]) => {
        const sorted = [...attempts].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
        const latest = sorted[sorted.length - 1];
        return {
          competency,
          latestScorePercent: latest.scorePercent,
          attemptCount: sorted.length,
          lastPracticedAt: latest.completedAt
        };
      });
      return { studentId, studentName, competencies: competencyList };
    });

    res.json(result);
  });

  // Mastery-over-time trend for a specific student+competency — shows how
  // scores on repeated micro-practice sets have changed, giving a genuine
  // "is this actually improving" signal beyond a single snapshot.
  app.get('/api/practice/history/:studentId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { competency } = req.query;
    const assignments = await dbStore.getMicroAssignments();

    let history = assignments.filter(a => a.studentId === req.params.studentId && a.completedAt);
    if (competency && typeof competency === 'string') {
      history = history.filter(a => a.competency === competency);
    }

    history.sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

    res.json(history.map(a => ({
      id: a.id,
      competency: a.competency,
      completedAt: a.completedAt,
      correctCount: a.correctCount,
      totalCount: a.totalCount,
      scorePercent: a.totalCount > 0 ? Math.round(((a.correctCount || 0) / a.totalCount) * 100) : 0
    })));
  });
}
