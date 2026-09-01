import express from 'express';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, UserRole, Question, Worksheet, TestHistoryEntry } from '../db';
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
      // Automatically fetch real enrolled students for this class — scoped
      // to the requesting user's own school(s), same as every other
      // role-scoped route in this app. The real frontend
      // (BulkDiagnosticWorkflow.tsx) always sends an explicit `students`
      // array pre-fetched from the scoped /api/students, so this branch is
      // only reachable via a direct API call that omits it — caught while
      // testing #304's fix, where an unscoped fetch here returned every
      // Class-N student nationwide (28,813 for one real class number)
      // instead of the caller's own roster. A 5000-set ceiling downstream
      // stopped it from actually generating anything, but the query itself
      // had no business reading outside the caller's scope in the first
      // place — not otherwise reachable by a real user today, but
      // defense-in-depth against a future caller of this branch.
      let scopedSchoolIds: string[] | undefined;
      if (user.role === UserRole.TEACHER || user.role === UserRole.SCHOOL) {
        scopedSchoolIds = user.schoolId ? [user.schoolId] : [];
      } else if (user.role === UserRole.VOLUNTEER) {
        scopedSchoolIds = user.assignedSchools || [];
      } else if (user.role === UserRole.BLOCK_ADMIN) {
        const schools = await dbStore.getSchools();
        scopedSchoolIds = schools.filter(s => s.blockCode === user.blockCode).map(s => s.id);
      }
      // SUPERADMIN/ADMIN/DISTRICT_ADMIN: no scope restriction here — they
      // already receive unrestricted authorization below (line ~93-ish),
      // same as the rest of this route's role tiering.

      const allDbStudents = await dbStore.getStudents(scopedSchoolIds ? { schoolId: scopedSchoolIds } : undefined);
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
              answerRegions: keyItem.answerRegions || [],
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

        // Issue #182: log this bulk request to Test History. Only the
        // diagnostic bulk route exists today — practice/remedial equivalents
        // (issue #183) will call the same dbStore method once they exist.
        const testHistoryEntry: TestHistoryEntry = {
          id: 'th_' + randomUUID(),
          teacherId: user.id,
          teacherEmail: user.email,
          requestType: 'diagnostic',
          timestamp: nowIso,
          studentCount: realStudentIds.length,
          classId: matchedClass?.id,
          className: `Class ${classNumber}`,
          schoolId: user.schoolId || matchedClass?.schoolId,
        };
        await dbStore.addTestHistoryEntry(testHistoryEntry);

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

  // Group blanks by physical row on the printed sheet so the verify-table
  // UI shows one field per row (not one per blank box).
  //
  // Implementation note: the paper's `coords_mm` layout data is incomplete
  // and inconsistent — several sections (Match Shapes, Patterns and
  // Position, Compare Objects) have NO items in `sections[].items[]` and
  // the answer-key record's `answerKey[]` is the authoritative source of
  // truth. The q-key → item mapping is also unreliable (q-keys are
  // question-numbers-within-section, not section-indexed, and multiple
  // sections share the same q-key). So this helper falls back to
  // parsing the answer-key IDs themselves: `Q_L20_<sec>_<q>[_b<blank>]`.
  // That encoding is stable across all 42 boxes in the paper and lets us
  // derive section + question + blank index without trusting the broken
  // coords_mm layout for the unknown sections.
  //
  // Output: a `rows[]` array, one entry per printed row. Each entry:
  //   - rowId: "R1", "R2", ...
  //   - questionIds: list of question_ids whose boxes share this row
  //   - question, correctAnswer: comma-joined blanks left-to-right
  //   - topic, subtopic, source_level, ... (from the matching item
  //     when present, otherwise from the section)
  //   - blanks: detailed per-box info for the UI
  const Y_TOL_MM = 1.5;
  function groupAnswerKeyByRow(ak: any): Array<{
    rowId: string;
    rowIndex: number;
    questionIds: string[];
    question: string;
    correctAnswer: string;
    topic?: string;
    subtopic?: string;
    source_level?: number;
    difficulty?: string;
    blanks: Array<{ questionId: string; answer: string; x_min: number; y_min: number }>;
  }> {
    const sections: any[] = ak?.masterJson?.sections || [];
    const answerKey: any[] = Array.isArray(ak?.answerKey) ? ak.answerKey : [];
    const questions: any[] = Array.isArray(ak?.questions) ? ak.questions : [];
    const coords_mm: Record<string, Record<string, { x_min: number; y_min: number; x_max: number; y_max: number }>> =
      ak?.masterJson?.coords_mm || {};

    // Build a fast lookup: question_id -> questions[] entry (for the
    // question prompt text + topic metadata).
    const qById = new Map<string, any>();
    for (const q of questions) {
      const id = q?.question_id || q?.qid || q?.id;
      if (id) qById.set(id, q);
    }
    const akByQid = new Map<string, any>();
    for (const e of answerKey) {
      const id = e?.question_id || e?.qid || e?.id;
      if (id) akByQid.set(id, e);
    }

    // Parse each answerKey entry to extract (sectionIdx, qIdx, blankIdx)
    // from the ID like Q_L20_1_2_b3 → sec=1, q=2, blank=3. The answerKey
    // is the authoritative source of correct answers, but several paper-
    // generator bugs leave the answerKey[] value empty or stringified
    // (e.g. Tens and Ones was stored as "[object Object]" because the
    // expected value was an object). When that happens, fall back to the
    // matching item's metadata in sections[].items[].
    type Parsed = {
      questionId: string;
      sectionIdx: number; // 1-based
      qIdx: number;       // 1-based question within section
      blankIdx: number | null; // null when no _b suffix
      answer: string;
      x_min: number;
      y_min: number;
      qEntry: any;       // matching questions[] entry (for prompt/topic)
      sectionTitle: string;
    };
    // Build a fallback answer for a (sectionIdx, qIdx) pair by mining
    // the matching item's data/icr fields. Sections without question
    // fields (Match Shapes etc.) are indexed by item position.
    function fallbackAnswerFor(secIdx: number, qIdx: number): string {
      const section = sections[secIdx - 1];
      if (!section) return '';
      // First try to find the item with question === qIdx.
      let item = (section.items || []).find((it: any) => it?.question === qIdx);
      // Fall back to position-based: items without question fields are
      // laid out in document order, so items[qIdx-1] is the qIdx'th item.
      if (!item) item = (section.items || [])[qIdx - 1];
      if (!item) return '';
      const icr = item.icr || {};
      const data = item.data || {};
      // Tens and Ones: icr.expected is an object {tens, ones, number};
      // the student writes a single number (data.number).
      if (data.number != null && typeof data.number !== 'object') {
        return String(data.number);
      }
      // Match Shapes: icr.from_label → icr.to_label describes the match.
      if (icr.from_label && icr.to_label) {
        return `${icr.from_label} → ${icr.to_label}`;
      }
      // Compare Objects: data.answer holds "Left" or "Right".
      if (typeof data.answer === 'string') return data.answer;
      return '';
    }
    const parsed: Parsed[] = [];
    for (const e of answerKey) {
      const qid = String(e?.question_id || e?.qid || e?.id || '');
      // Expected patterns:
      //   Q_L20_<sec>_<q>           (single-slot question)
      //   Q_L20_<sec>_<q>_b<blank>   (multi-slot question, one entry per blank)
      const m = /^Q_L\d+_(\d+)_(\d+)(?:_b(\d+))?$/.exec(qid);
      if (!m) {
        // Unknown ID shape — emit as best-effort single row entry.
        parsed.push({
          questionId: qid,
          sectionIdx: 0,
          qIdx: 0,
          blankIdx: null,
          answer: String(e?.answer ?? ''),
          x_min: 0,
          y_min: 0,
          qEntry: qById.get(qid),
          sectionTitle: '',
        });
        continue;
      }
      const sectionIdx = parseInt(m[1], 10);
      const qIdx = parseInt(m[2], 10);
      const blankIdx = m[3] != null ? parseInt(m[3], 10) : null;
      const section = sections[sectionIdx - 1] || null;
      const sectionTitle = section?.section || '';
      // Use the answerKey value if it's a real (non-empty, non-
      // stringified-object) string. Otherwise fall back to the item's
      // metadata so Tens and Ones / Match Shapes / Compare Objects all
      // resolve correctly.
      const rawAnswer = String(e?.answer ?? '');
      const isPlaceholder = !rawAnswer || rawAnswer === '[object Object]';
      const answer = isPlaceholder ? fallbackAnswerFor(sectionIdx, qIdx) : rawAnswer;
      parsed.push({
        questionId: qid,
        sectionIdx,
        qIdx,
        blankIdx,
        answer,
        // Default coords; real y_min comes from coords_mm below if we
        // can find a matching layout key for this (sec, q, blank).
        x_min: 0,
        y_min: 0,
        qEntry: qById.get(qid),
        sectionTitle,
      });
    }

    // Try to enrich each entry with real y_min from coords_mm so the
    // row-grouping can use the printed-row coordinate. The layout key
    // mapping is broken in some sections (q-key is shared across
    // sections), so we can't blindly map sec+q to q-key. Instead we use
    // a heuristic: for each (sec, qIdx) pair, scan ALL layout keys qK
    // and check which one matches the right item in that section. The
    // first layout key whose item matches (sec, qIdx) is the owner.
    //
    // Layout → section-index mapping is rebuilt fresh here because the
    // masterJson layout is unreliable for some sections.
    const layoutKeyOwners: Record<string, { sectionIdx: number; qIdx: number }> = {};
    for (const layoutKey of Object.keys(coords_mm)) {
      const k = parseInt(layoutKey.slice(1), 10); // qK → K
      if (!Number.isFinite(k)) continue;
      // For each section, find an item whose layout key is qK (the
      // section's question-number-within-section). Many items don't
      // carry an explicit question number, so we ALSO fall back to
      // matching by the section's item index (0-based + 1 = qIdx).
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const items = sections[sIdx]?.items || [];
        for (let iIdx = 0; iIdx < items.length; iIdx++) {
          const item = items[iIdx];
          const iq = item?.question ?? item?.data?.question;
          if (iq === k) {
            layoutKeyOwners[layoutKey] = { sectionIdx: sIdx + 1, qIdx: k };
            break;
          }
          // Fallback: when no question field, use item-index+1 as the
          // implicit qIdx. This handles Match Shapes (q=None) etc.
          if (iq == null && iIdx + 1 === k && layoutKeyOwners[layoutKey] == null) {
            layoutKeyOwners[layoutKey] = { sectionIdx: sIdx + 1, qIdx: k };
          }
        }
        if (layoutKeyOwners[layoutKey]) break;
      }
    }

    // For each parsed entry, find the matching layout-region key (if any)
    // and use its y_min/x_min for grouping. Multi-slot items use
    // qN-rM-bK; single-slot use qN-ans-K; section-specific naming (qN-rM-
    // posN for Size Ordering, qN-rM-NUMBER/ONES/TENS for Tens and Ones,
    // qN-(left|right)-N for Patterns, qN-rM-nextN for Patterns
    // continuation, qN-rM-(left|right) for Compare Objects).
    function findLayoutRegion(sec: number, q: number, blank: number | null): { x_min: number; y_min: number } | null {
      const layoutKey = `q${q}`;
      const layout = coords_mm[layoutKey];
      if (!layout) return null;
      // Owner-check: does this layout key actually belong to (sec, q)?
      // If not, skip — wrong attribution would mix sections.
      const owner = layoutKeyOwners[layoutKey];
      if (owner && owner.sectionIdx !== sec) return null;
      if (blank != null) {
        // Look for qN-rM-bK first
        let key = Object.keys(layout).find(k => new RegExp(`^q${q}-r\\d+-b${blank}$`).test(k));
        if (!key) key = Object.keys(layout).find(k => new RegExp(`^q${q}-r\\d+-pos${blank}$`).test(k));
        if (key) return layout[key];
      }
      // Fall back to any region in this layout (single-slot or first
      // available). For Tens and Ones use the number/ones/tens keys.
      const tensOnesKey = blank != null ? Object.keys(layout).find(k =>
        new RegExp(`^q${q}-r\\d+-(\\w+)$`).test(k) && !k.includes('row-')
      ) : null;
      if (tensOnesKey) {
        // Pick the subfield whose name corresponds to the blank index.
        const m = tensOnesKey.match(new RegExp(`^q${q}-r\\d+-(\\w+)$`));
        const sub = m?.[1] || '';
        if (sub) return layout[tensOnesKey];
      }
      // Last resort: first non-row-* key in the layout (for items
      // with no explicit blank structure).
      const firstKey = Object.keys(layout).find(k => !k.includes('row-'));
      if (firstKey) return layout[firstKey];
      return null;
    }
    for (const p of parsed) {
      const region = findLayoutRegion(p.sectionIdx, p.qIdx, p.blankIdx);
      if (region) {
        p.x_min = region.x_min;
        p.y_min = region.y_min;
      }
    }

    // Group by (sectionIdx, qIdx). All blanks within the same question
    // collapse to one row in the UI; the correctAnswer is the
    // comma-space-joined blanks in blankIdx order. When no blanks
    // (single-slot items), each qIdx is its own row.
    const byQuestion = new Map<string, Parsed[]>();
    for (const p of parsed) {
      const key = `${p.sectionIdx}:${p.qIdx}`;
      if (!byQuestion.has(key)) byQuestion.set(key, []);
      byQuestion.get(key)!.push(p);
    }

    // Build the rows. Sort by (sectionIdx, qIdx) so the order matches
    // the printed paper's section flow. Within each question, sort
    // blanks by blankIdx (then by x_min as a fallback when blankIdx is
    // missing).
    const sortedKeys = Array.from(byQuestion.keys()).sort((a, b) => {
      const [sa, qa] = a.split(':').map(Number);
      const [sb, qb] = b.split(':').map(Number);
      return sa - sb || qa - qb;
    });
    const rows: any[] = [];
    sortedKeys.forEach((key, rowIdx) => {
      const entries = byQuestion.get(key)!;
      // Sort blanks within a question by blankIdx (left-to-right on paper).
      entries.sort((a, b) => {
        if (a.blankIdx != null && b.blankIdx != null) return a.blankIdx - b.blankIdx;
        if (a.blankIdx != null) return -1;
        if (b.blankIdx != null) return 1;
        return a.x_min - b.x_min;
      });
      // Use the smallest y_min across this question's blanks as the
      // row's y (for grouping into printed rows when coords are sparse).
      const rowY = entries.reduce((min, e) => Math.min(min, e.y_min || 1e9), 1e9);
      const rowX = entries.reduce((min, e) => Math.min(min, e.x_min || 1e9), 1e9);
      const section = sections[entries[0].sectionIdx - 1] || null;
      const firstItem = section?.items?.[entries[0].qIdx - 1] || null;
      const correctAnswer = entries.map(e => e.answer).join(', ');
      const questionIds = entries.map(e => e.questionId);
      const blanks = entries.map(e => ({
        questionId: e.questionId,
        answer: e.answer,
        x_min: e.x_min,
        y_min: e.y_min,
      }));
      const question = section?.section
        ? `${section.section} #${entries[0].qIdx}`
        : (firstItem?.data?.question != null
            ? `Question #${firstItem.data.question}`
            : `Question #${entries[0].qIdx}`);
      rows.push({
        rowId: `R${rowIdx + 1}`,
        rowIndex: rowIdx + 1,
        questionIds,
        question,
        correctAnswer,
        topic: firstItem?.topic || entries[0].qEntry?.topic,
        subtopic: firstItem?.subtopic,
        source_level: firstItem?.source_level || entries[0].qEntry?.source_level,
        difficulty: firstItem?.difficulty,
        blanks,
        // Internal helpers — not part of the API contract but useful
        // when the frontend needs to look up sections by question id.
        _sectionIdx: entries[0].sectionIdx,
        _qIdx: entries[0].qIdx,
        _rowY: rowY === 1e9 ? null : rowY,
        _rowX: rowX === 1e9 ? null : rowX,
      } as any);
    });

    // Final cross-question grouping by row-coordinate: merge consecutive
    // rows whose rowY differs by ≤ Y_TOL_MM. This is what makes the
    // user-requested behavior work: a "Before After Q3" answer box at
    // y=84.38 and a "Compare Q3" answer box at the same y=84.38 (which
    // happens to land on the next printed row of the previous section)
    // collapse into one UI field with comma-joined answers.
    rows.sort((a: any, b: any) => (a._rowY ?? 1e9) - (b._rowY ?? 1e9));
    const grouped: any[] = [];
    for (const r of rows) {
      const last = grouped[grouped.length - 1];
      if (last && last._rowY != null && r._rowY != null && Math.abs(last._rowY - r._rowY) <= Y_TOL_MM) {
        // Merge into last row
        last.questionIds = last.questionIds.concat(r.questionIds);
        last.blanks = last.blanks.concat(r.blanks);
        last.correctAnswer = last.blanks.map((b: any) => b.answer).filter((a: string) => a && a.length).join(', ');
        // Keep first row's id/question for clarity
      } else {
        grouped.push({ ...r });
      }
    }
    // Renumber rowIds after merging
    grouped.forEach((r, i) => { r.rowId = `R${i + 1}`; r.rowIndex = i + 1; });
    // Drop internal helpers from the final output
    for (const r of grouped) {
      delete r._sectionIdx;
      delete r._qIdx;
      delete r._rowY;
      delete r._rowX;
    }
    return grouped;
  }

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
        // Group blanks by physical row on the printed sheet so the
        // verify-table UI shows one field per row (not one per blank box).
        // Multi-slot questions like "Fill in 1-10" render multiple boxes
        // on a single line — those collapse into one row whose correct
        // answer is the comma-space-joined blanks (matching the OCR's
        // row_N convention: "row_1": "2, 4, 7").
        const rows = groupAnswerKeyByRow(answerKey);
        res.json({ ...(answerKey as any), rows });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to retrieve answer key.' });
      }
    });

    // Get the most recently generated diagnostic answer key for an entire
    // class. Used by the ICR single-sheet scan flow when no specific student
    // is selected (e.g. a teacher scans one sheet and the OCR needs to know
    // what the correct answers were). The class paper is shared across
    // students up to per-student randomization, so this is a safe proxy.
    app.get('/api/diagnostic/class/:classNumber/answer-key', async (req, res) => {
      const user = getAuthUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const classNumber = parseInt(req.params.classNumber, 10);
      if (!Number.isFinite(classNumber) || classNumber < 1) {
        return res.status(400).json({ error: 'Invalid class number.' });
      }

      try {
        const answerKey = await dbStore.getLatestClassAnswerKey(classNumber);
        if (!answerKey) {
          return res.status(404).json({ error: `No diagnostic answer key found for class ${classNumber}.` });
        }
        res.json(answerKey);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to retrieve class answer key.' });
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
        pdfUrl = `/output/${result.pdfFileName || result.fileName}`;
        const singleKey = Array.isArray(result.answerKeyData) ? result.answerKeyData[0] : undefined;
        // The paper is rendered per student, and `answerKeyData[].questions` is
        // the set that was actually printed — the same numbering the answer
        // regions are keyed by. `result.questions` is the generator's own list
        // and can differ; storing it leaves the regions pointing at question
        // ids the grader never looks up, so a scan reads every box and matches
        // none of them. The bulk path already prefers the per-student set.
        questions = (singleKey?.questions && singleKey.questions.length > 0)
          ? singleKey.questions as Question[]
          : result.questions;
        if (singleKey) {
          const keyItem = singleKey;
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
            questions,
            answerKey: keyItem.answerKey || [],
            answerRegions: keyItem.answerRegions || [],
            createdAt: new Date().toISOString()
          });
          // Point the student at the paper that was just printed for them.
          //
          // Grading resolves questions through students.assignedDiagnosticQuestions
          // (db.ts tier 2) whenever no jobId is supplied — which is the case for
          // every scan upload. Without this the student keeps whatever paper was
          // assigned before, the stored answer regions key off the new paper's
          // question ids, the two share no ids at all, and a perfectly legible
          // scan yields zero answers. The bulk path has always done this.
          await dbStore.assignDiagnosticPaperToStudent(student.id, questions);
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
