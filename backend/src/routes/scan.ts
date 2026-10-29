import express from 'express';
import { dbStore, ScanPaperTemplate, Student, Question, AnswerSubmission, EvaluationReport } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';

export function registerScanRoutes(app: express.Express) {
  type ScanQrIdentity = { studentId?: string; paperId?: string; testId?: string; pageNumber?: number; raw: string };

  function parseScanQrPayload(rawText: string): ScanQrIdentity {
    const raw = String(rawText || '').trim();
    const parsed: ScanQrIdentity = { raw };
    if (!raw) return parsed;

    if (raw.startsWith('{')) {
      try {
        const payload = JSON.parse(raw);
        return {
          studentId: payload.student_id || payload.studentId,
          paperId: payload.paper_id || payload.paperId || payload.paperPageId,
          testId: payload.test_id || payload.testId || payload.assessmentId,
          pageNumber: Number(payload.page || payload.pageNumber || 1),
          raw
        };
      } catch {
        return parsed;
      }
    }

    if (raw.includes('|') && !raw.includes(':')) {
      const [studentId, paperId, testId, page] = raw.split('|').map(part => part.trim());
      return { studentId, paperId, testId, pageNumber: Number(page) || 1, raw };
    }

    raw.split('|').forEach(part => {
      const [rawKey, ...rest] = part.split(':');
      const key = rawKey.trim().toUpperCase();
      const value = rest.join(':').trim();
      if (key === 'SID' || key === 'STUDENT' || key === 'STUDENT_ID') parsed.studentId = value;
      if (key === 'PAPER' || key === 'PAPER_ID') parsed.paperId = value;
      if (key === 'TEST' || key === 'TEST_ID') parsed.testId = value;
      if (key === 'PAGE' || key === 'PAGE_NUMBER') parsed.pageNumber = Number(value) || 1;
    });
    return parsed;
  }

  function questionFromScanTemplate(q: any, student: Student): Question {
    const questionType = q.questionType || 'text';
    return {
      question_id: q.questionId,
      question: q.prompt || `${q.questionLabel} ${questionType.replace('_', ' ')}`,
      answer: q.answerKey || '',
      answer_type: q.answerType || (questionType === 'multiple_choice' ? 'choice' : 'text'),
      question_format: questionType,
      choices: q.choices,
      topic: questionType,
      subtopic: 'scan-template',
      difficulty: 'medium',
      source_level: student.currentLevel || 1
    };
  }

  function modelQuestionType(questionType: string) {
    if (questionType === 'fill_blank') return 'numeric';
    if (questionType === 'multiple_choice') return 'mcq';
    if (questionType === 'match_pair') return 'matching';
    return 'short_text';
  }

  function toModelTemplate(template: ScanPaperTemplate) {
    const modelPage = { width: 2480, height: 3508 };
    const scaleX = modelPage.width / template.page.width;
    const scaleY = modelPage.height / template.page.height;
    const scaleRoi = (roi: { x: number; y: number; width: number; height: number }) => ({
      x: Math.round(roi.x * scaleX),
      y: Math.round(roi.y * scaleY),
      width: Math.max(1, Math.round(roi.width * scaleX)),
      height: Math.max(1, Math.round(roi.height * scaleY))
    });
    const topLeftMarker = template.fiducials.topLeft;

    return {
      paper_id: template.paperId,
      test_id: template.testId,
      answer_key_id: `${template.testId}:answer-key`,
      box_markers_required: false,
      page: {
        ...modelPage,
        marker_center_inset_x: Math.round((topLeftMarker.x + topLeftMarker.width / 2) * scaleX),
        marker_center_inset_y: Math.round((topLeftMarker.y + topLeftMarker.height / 2) * scaleY)
      },
      questions: template.questions.map(question => {
        const textBased = question.questionType === 'text' || question.questionType === 'fill_blank';
        const selectedRoi = textBased ? question.answerBoxes[0] : question.questionBox;
        if (!selectedRoi) throw new Error(`Question ${question.questionId} does not contain a scan ROI.`);
        return {
          question_id: question.questionId,
          label: question.questionLabel,
          type: modelQuestionType(question.questionType),
          source_question_type: question.questionType,
          prompt: question.prompt,
          answer_key: question.answerKey,
          marks: question.marks,
          roi: scaleRoi(selectedRoi),
          auto_score: textBased && question.autoScoreEligible
        };
      })
    };
  }

  async function scanContext(qrText: string) {
    const identity = parseScanQrPayload(qrText);
    if (!identity.studentId || !identity.paperId || !identity.testId) {
      return { error: 'QR must include student ID, paper ID, and test ID.', status: 400, identity } as const;
    }

    const pageNumber = identity.pageNumber || 1;
    const paperTemplate = await dbStore.getScanPaperTemplate(identity.paperId, pageNumber);
    if (!paperTemplate) {
      return { error: `No database scan template found for paper ${identity.paperId}, page ${pageNumber}.`, status: 404, identity } as const;
    }
    if (paperTemplate.studentId !== identity.studentId || paperTemplate.testId !== identity.testId) {
      return { error: 'QR identity does not match the stored paper template.', status: 409, identity } as const;
    }

    const students = await dbStore.getStudents();
    const student = students.find(item => item.id === identity.studentId);
    if (!student) return { error: `Student ${identity.studentId} was not found.`, status: 404, identity } as const;
    return { identity, paperTemplate, student } as const;
  }

  app.post('/api/ocr/scan/template', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const context = await scanContext(req.body?.qrText || '');
    if ('error' in context) return res.status(context.status).json({ error: context.error, detectedQr: context.identity });
    const { identity, paperTemplate, student } = context;
    if (!await canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden' });

    const questions = paperTemplate.questions.map((q: any) => questionFromScanTemplate(q, student));
    res.json({
      detectedQr: {
        studentId: identity.studentId,
        paperId: identity.paperId,
        testId: identity.testId,
        pageNumber: identity.pageNumber || 1,
        raw: identity.raw
      },
      student,
      paper: {
        id: identity.paperId,
        testId: identity.testId,
        pageNumber: identity.pageNumber || 1,
        page: paperTemplate.page,
        templateVersion: paperTemplate.templateVersion,
        qrSchema: paperTemplate.qrSchema,
        questions: paperTemplate.questions,
        questionModels: questions,
        templateUrl: `/output/${paperTemplate.templateFileName}`
      }
    });
  });

  app.post('/api/ocr/scan/process', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { qrText, imageDataUrl } = req.body || {};
    if (!qrText || !imageDataUrl) return res.status(400).json({ error: 'qrText and imageDataUrl are required.' });

    const context = await scanContext(qrText);
    if ('error' in context) return res.status(context.status).json({ error: context.error, detectedQr: context.identity });
    const { identity, paperTemplate, student } = context;
    if (!await canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden' });
    const serviceUrl = process.env.SMARTFLN_MODEL_SERVICE_URL || process.env.SMARTFLN_TROCR_URL || process.env.TROCR_SERVICE_URL || '';
    if (!serviceUrl) {
      return res.status(503).json({ error: 'The full-page model service is not configured. Set SMARTFLN_MODEL_SERVICE_URL.' });
    }

    try {
      const inferUrl = serviceUrl.endsWith('/v1/infer') ? serviceUrl : `${serviceUrl.replace(/\/$/, '')}/v1/infer`;
      const modelResponse = await fetch(inferUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(Number(process.env.SMARTFLN_MODEL_TIMEOUT_MS || 120000)),
        body: JSON.stringify({
          scanPageId: `scan_${identity.paperId}_${Date.now()}`,
          qrText,
          imageDataUrl,
          template: toModelTemplate(paperTemplate)
        })
      });
      const modelScan: any = await modelResponse.json().catch(() => ({}));
      if (!modelResponse.ok) {
        return res.status(502).json({ error: modelScan.error || modelScan.message || `Model service returned HTTP ${modelResponse.status}.` });
      }
      if (!modelScan.valid_paper || modelScan.ocr_started === false) {
        return res.status(422).json({
          error: modelScan.message || 'Scan rejected. A valid QR and all four corner fiducials are required.',
          invalidReason: modelScan.invalid_reason,
          validation: modelScan.validation,
          page: modelScan.page
        });
      }

      res.json({
        detectedQr: {
          studentId: identity.studentId,
          paperId: identity.paperId,
          testId: identity.testId,
          pageNumber: identity.pageNumber || 1,
          raw: identity.raw
        },
        student,
        paper: {
          id: paperTemplate.paperId,
          testId: paperTemplate.testId,
          pageNumber: paperTemplate.pageNumber,
          page: paperTemplate.page,
          templateVersion: paperTemplate.templateVersion,
          qrSchema: paperTemplate.qrSchema,
          questions: paperTemplate.questions,
          templateUrl: `/output/${paperTemplate.templateFileName}`
        },
        modelScan
      });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'The full-page model service is unreachable.' });
    }
  });

  app.post('/api/ocr/trocr', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageDataUrl, questionId, questionType, prompt, expectedAnswer, studentId, paperId, testId } = req.body || {};
    if (!imageDataUrl || !questionId) {
      return res.status(400).json({ error: 'imageDataUrl and questionId are required.' });
    }

    const serviceUrl = process.env.SMARTFLN_MODEL_SERVICE_URL || process.env.SMARTFLN_TROCR_URL || process.env.TROCR_SERVICE_URL || '';
    if (!serviceUrl) {
      return res.json({
        questionId,
        extractedText: '',
        confidence: 0,
        modelName: 'microsoft/trocr-base-handwritten',
        modelStatus: 'not_configured',
        needsReview: true,
        error: 'TrOCR service is not configured. Set SMARTFLN_MODEL_SERVICE_URL to the dev-2 model service, for example http://127.0.0.1:8090.'
      });
    }

    try {
      const inferUrl = serviceUrl.endsWith('/v1/infer') ? serviceUrl : `${serviceUrl.replace(/\/$/, '')}/v1/infer`;
      const modelQuestionType =
        questionType === 'fill_blank' ? 'numeric' :
          questionType === 'multiple_choice' ? 'mcq' :
            questionType === 'match_pair' ? 'matching' :
              'short_text';
      const trocrRes = await fetch(inferUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanPageId: paperId || questionId,
          assessmentId: testId || paperId || 'scan-template',
          studentId: studentId || 'unknown',
          crops: [{
            questionId,
            questionType: modelQuestionType,
            prompt: prompt || '',
            answerKey: expectedAnswer || '',
            imageDataUrl
          }]
        })
      });
      const data: any = await trocrRes.json().catch(() => ({}));
      if (!trocrRes.ok) {
        return res.json({
          questionId,
          extractedText: '',
          confidence: 0,
          modelName: 'microsoft/trocr-base-handwritten',
          modelStatus: 'service_error',
          needsReview: true,
          error: data.error || data.message || `TrOCR service returned HTTP ${trocrRes.status}`
        });
      }
      const result = Array.isArray(data.results) ? data.results.find((item: any) => item.questionId === questionId) || data.results[0] : data;
      const confidence = Math.max(0, Math.min(1, Number(result.confidence ?? result.score ?? result.diagnostics?.scoring?.confidence ?? 0)));
      res.json({
        questionId,
        extractedText: String(result.recognizedAnswer ?? result.extractedText ?? result.text ?? result.recognized_text ?? ''),
        confidence,
        modelName: result.modelName || result.model_name || 'microsoft/trocr-base-handwritten',
        modelStatus: result.providerStatus || result.modelStatus || result.status || 'ok',
        modelVersion: result.modelVersion || '',
        needsReview: Boolean(result.needsReview ?? confidence < 0.4),
        diagnostics: result.diagnostics || {}
      });
    } catch (error: any) {
      res.json({
        questionId,
        extractedText: '',
        confidence: 0,
        modelName: 'microsoft/trocr-base-handwritten',
        modelStatus: 'unreachable',
        needsReview: true,
        error: error.message || 'TrOCR service is unreachable.'
      });
    }
  });

  app.post('/api/ocr/scan/finalize', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, paperId, testId, reviewItems } = req.body || {};
    if (!studentId || !paperId || !Array.isArray(reviewItems)) {
      return res.status(400).json({ error: 'studentId, paperId, and reviewItems are required.' });
    }

    const students = await dbStore.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!await canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden' });

    const unresolved = reviewItems.some((item: any) => item.needsReview && !item.finalMark);
    if (unresolved) return res.status(400).json({ error: 'Every volunteer-review answer must be marked before saving.' });

    const answers: { [questionId: string]: string } = {};
    reviewItems.forEach((item: any) => {
      answers[item.questionId] = JSON.stringify({
        finalMark: item.finalMark,
        marks: Number(item.marks || 0),
        confidence: Number(item.confidence || 0),
        ocrOutput: item.extractedText || '',
        expectedAnswer: item.expectedAnswer || '',
        reviewStatus: item.needsReview ? 'volunteer_reviewed' : 'auto_evaluated',
        modelName: item.modelName || '',
        questionType: item.questionType || '',
        roi: item.roi || null
      });
    });

    const score = reviewItems.reduce((sum: number, item: any) => sum + Number(item.marks || 0), 0);
    const submission: AnswerSubmission = {
      id: 'sub_scan_' + Date.now(),
      worksheetId: paperId,
      studentId: student.id,
      studentName: student.name,
      schoolId: student.schoolId,
      classId: student.classGroup,
      submittedAt: new Date().toISOString(),
      isDelayed: false,
      answers
    };
    await dbStore.addAnswerSubmission(submission);

    const report: EvaluationReport = {
      id: 'rep_scan_' + Date.now(),
      studentId: student.id,
      worksheetId: paperId,
      score,
      totalQuestions: reviewItems.length,
      conceptMastery: { OCR: score >= reviewItems.length * 0.7 ? 'Strong' : 'Needs Practice' },
      narrative: `OCR scan saved for ${student.name}. Test ${testId || paperId} scored ${score}/${reviewItems.length}; confidence, OCR output, marks, and review status were stored per question.`,
      recommendedLevel: student.currentLevel,
      recommendedSubLevel: student.currentSubLevel || 0,
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
      details: `OCR scan finalized for ${student.name}.`
    });

    res.json({ submission, report });
  });

  // Generate Personalized Level-Wise Worksheets for a whole roster of
  // students in ONE batch call to Levels_backend (the "Generate Batch"
  // button in the teacher dashboard's Level-Wise Paper Generator panel).

}
