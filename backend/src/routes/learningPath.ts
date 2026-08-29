// ============================================================================
// Learning Path routes  (teacher-mediated remediation loop)
// ============================================================================
//
// Exposes a student's durable remediation journey — the ordered list of
// prerequisite + gap concepts the diagnostic surfaced — and lets a teacher work
// through it: regenerate it from the latest diagnostic, advance a step's status
// as they teach it, and print targeted practice for any step.
//
// This file owns only HTTP concerns (auth, scoping, persistence, logging). All
// ordering / merging logic lives in the pure ../learningPathEngine module so it
// can be unit-tested without express or a database. Auth + student scoping
// mirror ../routes/students.ts exactly (getAuthUser + canAccessStudent), and
// persistence rides on the same dbStore.updateStudent path the diagnostic
// submit handler already uses, so both DB modes (Atlas / local file) behave
// identically to the rest of the app.
//
//   GET    /api/students/:id/learning-path
//   POST   /api/students/:id/learning-path/recompute
//   PATCH  /api/students/:id/learning-path/nodes/:conceptId      { status }
//   GET    /api/students/:id/learning-path/nodes/:conceptId/practice?subLevel=

import express from 'express';
import { dbStore, EvaluationReport } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { generateQuestionsForLevel } from '../levelGenerator';
import {
  buildLearningPath,
  applyNodeStatus,
  summarizeLearningPath,
  isLearningPathStatus,
  LearningPathInput,
} from '../learningPathEngine';

export function registerLearningPathRoutes(app: express.Express) {
  // ─── helpers ────────────────────────────────────────────────────────────────

  // The latest report that came out of the diagnostic pipeline — i.e. one that
  // carries the per-level pass/fail breakdown (failedLevels) or skillGaps. A
  // plain worksheet evaluation (which has neither) must never override a real
  // diagnostic here, so it is filtered out. An all-pass diagnostic (empty
  // failedLevels/skillGaps) IS eligible: it correctly yields an empty path,
  // meaning "no current gaps".
  async function latestDiagnosticReport(studentId: string): Promise<EvaluationReport | null> {
    const reports = (await dbStore.getEvaluationReports({ studentIds: [studentId] }))
      .filter((r) => r.studentId === studentId);
    const diagnostic = reports.filter(
      (r) => r.failedLevels !== undefined || r.skillGaps !== undefined,
    );
    if (diagnostic.length === 0) return null;
    return [...diagnostic].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0] ?? null;
  }

  function reportGapInput(report: EvaluationReport): LearningPathInput {
    return {
      failedLevels: report.failedLevels,
      skillGaps: report.skillGaps,
      sourceReportId: report.id,
    };
  }

  function reportMeta(r: EvaluationReport) {
    return {
      id: r.id,
      timestamp: r.timestamp,
      score: r.score,
      totalQuestions: r.totalQuestions,
      failedLevels: r.failedLevels ?? [],
      passedLevels: r.passedLevels ?? [],
      skillGapCount: r.skillGaps?.length ?? 0,
    };
  }

  // ─── GET current path ─────────────────────────────────────────────────────────
  app.get('/api/students/:id/learning-path', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const persisted = student.learningPath ?? null;
    const report = await latestDiagnosticReport(student.id);

    // The stored path is "stale" once a newer diagnostic exists than the one it
    // was generated from — the UI uses this to nudge a recompute.
    const stale = !!(
      report &&
      persisted &&
      new Date(report.timestamp).getTime() > new Date(persisted.generatedAt).getTime()
    );

    res.json({
      student: {
        id: student.id,
        name: student.name,
        displayId: student.displayId,
        classGroup: student.classGroup,
        section: student.section,
        currentLevel: student.currentLevel,
      },
      learningPath: persisted,
      summary: summarizeLearningPath(persisted),
      canRecompute: !!report,
      stale,
      sourceReport: report ? reportMeta(report) : null,
    });
  });

  // ─── POST recompute from latest diagnostic ─────────────────────────────────────
  app.post('/api/students/:id/learning-path/recompute', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const report = await latestDiagnosticReport(student.id);
    if (!report) {
      return res.status(409).json({
        error: 'No diagnostic report found for this student. Run a diagnostic first.',
      });
    }

    // Preserve any progress the teacher has already recorded: nodes that still
    // apply keep their status/timestamps, new gaps arrive as 'not_started'.
    const path = buildLearningPath(reportGapInput(report), student.learningPath ?? null);
    await dbStore.updateStudent(student.id, { learningPath: path });

    await dbStore.addLog({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      schoolId: student.schoolId,
      schoolName: 'GPS',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      activityType: 'verify',
      status: 'Success',
      details: `Generated learning path for ${student.name} (${path.nodes.length} steps) from report ${report.id}`,
    });

    res.json({
      learningPath: path,
      summary: summarizeLearningPath(path),
      sourceReport: reportMeta(report),
    });
  });

  // ─── PATCH a single node's status ──────────────────────────────────────────────
  app.patch('/api/students/:id/learning-path/nodes/:conceptId', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const { status } = req.body ?? {};
    if (!isLearningPathStatus(status)) {
      return res
        .status(400)
        .json({ error: 'status must be one of: not_started, in_progress, mastered.' });
    }
    if (!student.learningPath) {
      return res.status(409).json({ error: 'No learning path to update. Generate one first.' });
    }

    const updated = applyNodeStatus(student.learningPath, req.params.conceptId, status);
    if (!updated) {
      return res.status(404).json({ error: 'No such concept in this learning path.' });
    }

    await dbStore.updateStudent(student.id, { learningPath: updated });
    res.json({ learningPath: updated, summary: summarizeLearningPath(updated) });
  });

  // ─── GET printable practice for one node ───────────────────────────────────────
  app.get('/api/students/:id/learning-path/nodes/:conceptId/practice', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const node = student.learningPath?.nodes.find((n) => n.conceptId === req.params.conceptId);
    if (!node) return res.status(404).json({ error: 'No such concept in this learning path.' });

    // subLevel: 0 Mastery, 1 Easier, 2 Remedial. Default to Easier for
    // remediation practice; allow an explicit override via ?subLevel=.
    const rawSub = parseInt(String(req.query.subLevel ?? ''), 10);
    const subLevel = [0, 1, 2].includes(rawSub) ? rawSub : 1;

    const questions = generateQuestionsForLevel(node.level, subLevel);
    res.json({
      conceptId: node.conceptId,
      level: node.level,
      levelTitle: node.levelTitle,
      strand: node.strand,
      subLevel,
      questions,
    });
  });
}
