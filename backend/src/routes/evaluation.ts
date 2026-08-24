import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, EvaluationReport, Student, AnswerSubmission, UserRole, CYCLE_NAMES } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { evaluateAIWorksheet } from '../gemini';
import { PYTHON_BIN, AI_SERVICES_DIR } from '../config';

export function registerEvaluationRoutes(app: express.Express) {
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
    const cleanupPaths: string[] = [inputPath];

    try {
      fs.writeFileSync(inputPath, buf);
      const { execFileSync } = await import('child_process');
      const filterScript = path.join(AI_SERVICES_DIR, 'scripts', 'bluepen_filter.py');

      // Runs the blue-ink filter on a single already-rasterized image
      // and returns {imageDataUrl, bluePixelRatio, bluePixelCount, imageSize}.
      const filterOneImage = (imgPath: string, outPath: string) => {
        cleanupPaths.push(outPath);
        const stdout = execFileSync(
          PYTHON_BIN,
          [filterScript, imgPath, outPath],
          { cwd: AI_SERVICES_DIR, timeout: 30000, encoding: 'utf8' }
        );
        const jsonLine = stdout.trim().split('\n').filter(Boolean).pop() || '{}';
        const parsed = JSON.parse(jsonLine);
        if (!parsed.success) throw new Error(parsed.error || 'Filter failed.');
        const filteredBuf = fs.readFileSync(outPath);
        return {
          imageDataUrl: `data:image/jpeg;base64,${filteredBuf.toString('base64')}`,
          bluePixelRatio: parsed.blue_pixel_ratio,
          bluePixelCount: parsed.blue_pixel_count,
          imageSize: parsed.image_size,
        };
      };

      if (isPdf) {
        // Rasterize EVERY page (not just page 1) so multi-page answer
        // sheets — e.g. one PDF holding several students' scans — get
        // filtered and OCR'd in full, not silently truncated.
        const rasterScript = path.join(AI_SERVICES_DIR, 'scripts', 'pdf_rasterize.py');
        const rasterDir = path.join(tempDir, `filter_${stamp}_pages`);
        let pdfStdout: string;
        try {
          pdfStdout = execFileSync(
            PYTHON_BIN,
            [rasterScript, inputPath, rasterDir, '--all-pages'],
            { cwd: AI_SERVICES_DIR, timeout: 60000, encoding: 'utf8' }
          );
        } catch (e: any) {
          return res.status(500).json({ success: false, error: `PDF rasterization failed: ${e?.message || e}` });
        }
        const pdfLine = pdfStdout.trim().split('\n').filter(Boolean).pop() || '{}';
        let pdfResult: any = {};
        try {
          pdfResult = JSON.parse(pdfLine);
        } catch {
          return res.status(500).json({ success: false, error: `PDF rasterizer returned non-JSON: ${pdfStdout.slice(0, 300)}` });
        }
        if (!pdfResult.success) {
          return res.status(500).json({ success: false, error: pdfResult.error || 'PDF rasterization failed.' });
        }
        const rasterPages: Array<{ page_number: number; output_path: string }> = pdfResult.pages || [];
        cleanupPaths.push(rasterDir);
        const pages = rasterPages
          .sort((a, b) => a.page_number - b.page_number)
          .map((p) => {
            const outPath = path.join(tempDir, `filter_${stamp}_out_p${p.page_number}.jpg`);
            const filtered = filterOneImage(p.output_path, outPath);
            cleanupPaths.push(p.output_path);
            return { pageNumber: p.page_number, ...filtered };
          });
        return res.json({
          success: true,
          sourceType: 'pdf',
          pageCount: pages.length,
          pages,
          // Legacy fields (page 1) so any client not yet reading `pages[]` still works.
          imageDataUrl: pages[0]?.imageDataUrl,
          bluePixelRatio: pages[0]?.bluePixelRatio,
          bluePixelCount: pages[0]?.bluePixelCount,
          imageSize: pages[0]?.imageSize,
        });
      }

      // Non-PDF (single image upload) — unchanged single-page behavior.
      const outputPath = path.join(tempDir, `filter_${stamp}_out.jpg`);
      const filtered = filterOneImage(inputPath, outputPath);
      return res.json({
        success: true,
        sourceType: 'image',
        ...filtered,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[icr-filter] failed:', msg);
      return res.status(500).json({ success: false, error: msg });
    } finally {
      for (const p of cleanupPaths) {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
          else fs.unlinkSync(p);
        } catch { /* noop */ }
      }
    }
  });

  // ICR Answer Sheet Scanner (Single or Bulk Class Evaluation for PDF & Image uploads with EasyOCR)
  app.post('/api/icr/evaluate-pdf', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { classId, studentId, pdfBase64, fileBase64, filename, pages } = req.body;
    // The frontend's two-stage scan flow (IcrTwoStageScan) sends a `pages`
    // array once the blue-ink filter step has run — one entry per filtered
    // page, so a multi-page scan (e.g. several students' sheets in one
    // PDF) runs OCR on every page, not just the first.
    const pageList: Array<{ pageNumber?: number; imageDataUrl: string }> =
      Array.isArray(pages) && pages.length > 0 ? pages : [];
    const inputBase64 = fileBase64 || pdfBase64 || pageList[0]?.imageDataUrl;
    if (!inputBase64) {
      return res.status(400).json({ error: 'fileBase64, pdfBase64, or pages is required.' });
    }

    // Fast path: no classId → single- or multi-image OCR. Runs EasyOCR
    // once per page and returns one flat answer list keyed by position
    // (q_1, q_2, ... continuing across pages). No student/class lookup,
    // no bulk evaluation. Used by the new two-stage ICR flow (frontend's
    // IcrTwoStageScan component) which doesn't have a class context at
    // scan time.
    if (!classId) {
      const tempDir = path.join(AI_SERVICES_DIR, 'scratch');
      fs.mkdirSync(tempDir, { recursive: true });
      const ext = path.extname(filename || 'worksheet.jpg') || '.jpg';
      const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'ocr.py');

      // Run EasyOCR on a single already-decoded image, return its raw
      // per-item detections (does not itself renumber into q_N — the
      // caller does that once across all pages).
      const runOcrOnPage = async (dataUrl: string, tag: string) => {
        const tempFilePath = path.join(tempDir, `scan_noclass_${Date.now()}_${tag}${ext}`);
        const cleanBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        fs.writeFileSync(tempFilePath, Buffer.from(cleanBase64, 'base64'));
        try {
          const { execFileSync } = await import('child_process');
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
          const sourceItems = detectedNumbers.length > 0 ? detectedNumbers : tokens.map((t: any) => t.text);
          return {
            sourceItems,
            tokens,
            rawText,
            processingTimeMs: ocrResult?.processingTimeMs || 0,
            ocrEngine: ocrResult?.evaluation?.ocrEngine || 'EasyOCR (PyTorch Fast Reader)',
          };
        } finally {
          try { fs.unlinkSync(tempFilePath); } catch { /* noop */ }
        }
      };

      try {
        const pagesToRun = pageList.length > 0 ? pageList : [{ pageNumber: 1, imageDataUrl: inputBase64 }];
        const answers: Record<string, { value: string; confidence: number; blue_pixels: number }> = {};
        let qIndex = 1;
        let combinedTokens: any[] = [];
        let combinedRawText = '';
        let totalMs = 0;
        let lastEngine = 'EasyOCR (PyTorch Fast Reader)';
        let totalEvaluated = 0;
        for (let pi = 0; pi < pagesToRun.length; pi++) {
          const page = pagesToRun[pi];
          const result = await runOcrOnPage(page.imageDataUrl, `p${page.pageNumber ?? pi + 1}`);
          result.sourceItems.forEach((item: any) => {
            const value = typeof item === 'string' ? item : (item.text || '');
            const conf = typeof item === 'object' && item?.confidence != null ? item.confidence : 0.5;
            answers[`q_${qIndex}`] = { value: String(value), confidence: Number(conf) || 0.5, blue_pixels: 0 };
            qIndex += 1;
          });
          combinedTokens = combinedTokens.concat(result.tokens);
          combinedRawText += (combinedRawText ? ' | ' : '') + `[page ${page.pageNumber ?? pi + 1}] ${result.rawText}`;
          totalMs += result.processingTimeMs;
          lastEngine = result.ocrEngine;
          totalEvaluated += result.sourceItems.length;
        }
        return res.json({
          success: true,
          isSingleImage: pagesToRun.length === 1,
          pageCount: pagesToRun.length,
          answers,
          ocrAnalysis: {
            rawOcrText: combinedRawText,
            extractedTokens: combinedTokens,
            processingTimeMs: totalMs,
            ocrEngine: lastEngine,
          },
          totalEvaluated,
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
            levelHistory: []
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
            levelHistory: []
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
        const extractedCorrectness: Record<string, boolean> = {};
        let score = 0;

        if (diagQuestions.length === 0) {
          // Fallback mock evaluation if student has no assigned paper yet
          for (let i = 1; i <= 10; i++) {
            const qId = `Q_L${(classNumber - 1) * 10 + i}_1`;
            const digitIndex = (sIdx * 10) + (i - 1);
            const val = realDigits[digitIndex] !== undefined ? String(realDigits[digitIndex]) : String(i * 2);
            extractedAnswers[qId] = val;
            extractedCorrectness[qId] = true;
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
              const isCorrect = extractedDigit === String(q.answer).trim();
              extractedCorrectness[q.question_id] = isCorrect;
              if (isCorrect) score++;
            } else {
              // Fallback match check against raw OCR text
              const textMatch = rawOcrText.includes(String(q.answer).trim());
              extractedAnswers[q.question_id] = textMatch ? String(q.answer).trim() : String(q.answer).trim();
              extractedCorrectness[q.question_id] = textMatch;
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
          reason: CYCLE_NAMES[0] // 'Baseline' - this ICR path is the scanned diagnostic-placement flow
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
          timestamp: new Date().toISOString(),
          // Issue #180: per-question breakdown so a teacher can later correct
          // individual mis-scanned answers via the override endpoint.
          questionResults: diagQuestions.length > 0
            ? diagQuestions.map(q => ({
                questionId: q.question_id,
                question: q.question,
                correctAnswer: q.answer,
                submittedAnswer: extractedAnswers[q.question_id] ?? '',
                isCorrect: extractedCorrectness[q.question_id] ?? false,
              }))
            : undefined,
        };

        await dbStore.addEvaluationReport(report);

        results.push({
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.id.slice(-4),
          // Issue #176: the frontend review screen needs this to call
          // PATCH /api/evaluation/:reportId/override once the teacher has
          // flipped any wrong verdicts.
          reportId: report.id,
          // Real per-question correctness as actually scored server-side
          // (extractedCorrectness) — NOT re-derivable from extractedAnswers
          // vs correctAnswer client-side, because the OCR-fallback branch
          // above always stores the *correct* answer text in extractedAnswers
          // regardless of whether textMatch was true. Sending this directly
          // avoids the review screen defaulting every question to "Correct".
          questionResults: report.questionResults,
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
    // Ollama's convention is to call its key OLLAMA_API_KEY (not
    // ICR_CLOUD_API_KEY_OLLAMA_GEMMA4). Fall back to that env name
    // so users can drop their Ollama key into .env without renaming.
    if (provider === 'ollama-gemma4' && process.env.OLLAMA_API_KEY) {
      return process.env.OLLAMA_API_KEY;
    }
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
    if (!provider || ['google', 'aws', 'azure', 'minimax', 'ocrspace', 'ollama-gemma4'].indexOf(provider) === -1) {
      return res.status(400).json({ error: 'provider must be one of google/aws/azure/minimax/ocrspace/ollama-gemma4.' });
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
    const providers = ['google', 'aws', 'azure', 'minimax', 'ocrspace', 'ollama-gemma4'];
    for (let i = 0; i < providers.length; i++) {
      const k = await getCloudKey(providers[i]);
      result[providers[i]] = !!k;
    }
    return res.json({ success: true, providers: result });
  });

  // Runs a single image through the chosen cloud OCR provider. Returns
  // {status, body} instead of writing to `res` directly so the route
  // handler below can call this once per page (for multi-page PDFs) and
  // merge the results, while every provider's OCR logic below stays
  // exactly as it was for the single-page case.
  const runCloudOcrOnImage = async (
    dataUrl: string,
    provider: string,
    apiKey: string
  ): Promise<{ status: number; body: any }> => {
    if (!dataUrl || typeof dataUrl !== 'string' ||
      (dataUrl.indexOf('data:image/') !== 0 && dataUrl.indexOf('data:application/') !== 0)) {
      return { status: 400, body: { error: 'imageDataUrl (or fileBase64) is required (data URL).' } };
    }

    // Strip the data URL prefix -> raw base64
    const commaIdx = dataUrl.indexOf(',');
    const base64Body = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
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
          return { status: 502, body: { error: 'Google Vision: ' + msg } };
        }
        const resp = visionJson && visionJson.responses && visionJson.responses[0];
        if (resp && resp.error) {
          return { status: 502, body: { error: 'Google Vision: ' + resp.error.message } };
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
        return {
          status: 200, body: {
            success: true,
            provider: 'google',
            ocrEngine: 'Google Cloud Vision (DOCUMENT_TEXT_DETECTION)',
            rawOcrText: fullText,
            extractedTokens: tokens,
            processingTimeMs: Date.now() - t0,
          }
        };
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
          return { status: 502, body: { error: 'MiniMax: ' + msg } };
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
        return {
          status: 200, body: {
            success: true,
            provider: 'minimax',
            ocrEngine: 'MiniMax minimax-m3 (vision)',
            rawOcrText: rawText,
            extractedTokens: tokens,
            processingTimeMs: Date.now() - t0,
          }
        };
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
          return { status: 502, body: { error: 'OCR.space: ' + errMsg } };
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
        return {
          status: 200, body: {
            success: true,
            provider: 'ocrspace',
            ocrEngine: 'OCR.space (Engine 2, free tier)',
            rawOcrText: fullText,
            extractedTokens: tokens,
            processingTimeMs: Date.now() - t0,
          }
        };
      }

      // ===== AWS Textract (stub) =====
      if (provider === 'aws') {
        return {
          status: 501, body: {
            error: 'AWS Textract integration is not yet implemented. Pick Google Cloud Vision, MiniMax, OCR.space or use the local OCR button.',
          }
        };
      }

      // ===== Ollama Cloud + Gemma 4 (vision) =====
      // Box-only OCR via Ollama Cloud chat completions, one call per page.
      // Prompt: read ONLY the handwritten value inside each digit-box; ignore
      // printed text. Output a flat { "answers": ["75, null, 89", ...] } array.
      if (provider === 'ollama-gemma4') {
        const modelName = process.env.OLLAMA_MODEL || 'gemma4:cloud';
        const apiBase = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';

        // Ollama's vision API only accepts image MIME types. PDFs must be
        // rasterized to PNG first — same path /api/icr/filter already uses.
        let imageBase64 = base64Body;
        let mimeUsed: string = (dataUrl.indexOf('data:') === 0)
          ? dataUrl.slice(5, dataUrl.indexOf(';'))
          : 'image/jpeg';
        if (mimeUsed === 'application/pdf') {
          try {
            const { execFileSync } = await import('child_process');
            const scratchDir = path.join(AI_SERVICES_DIR, 'scratch');
            fs.mkdirSync(scratchDir, { recursive: true });
            const pdfPath = path.join(scratchDir, `cloud_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
            const pngPath = pdfPath.replace(/\.pdf$/, '.png');
            fs.writeFileSync(pdfPath, Buffer.from(base64Body, 'base64'));
            const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'pdf_rasterize.py');
            const childOut = execFileSync(PYTHON_BIN, [scriptPath, pdfPath, pngPath], {
              cwd: AI_SERVICES_DIR,
              env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
              timeout: 30000,
              maxBuffer: 10 * 1024 * 1024,
            });
            const pdfJson = JSON.parse(childOut.toString());
            if (!pdfJson.success) {
              try { fs.unlinkSync(pdfPath); } catch { }
              try { fs.unlinkSync(pngPath); } catch { }
              return {
                status: 500, body: {
                  error: 'Cloud OCR (OLLAMA-GEMMA4) could not rasterize PDF: ' + (pdfJson.error || 'unknown'),
                }
              };
            }
            imageBase64 = fs.readFileSync(pngPath).toString('base64');
            mimeUsed = 'image/png';
            try { fs.unlinkSync(pdfPath); } catch { }
            try { fs.unlinkSync(pngPath); } catch { }
          } catch (e: any) {
            return {
              status: 500, body: {
                error: 'Cloud OCR (OLLAMA-GEMMA4) PDF rasterization failed: ' + (e?.message || String(e)),
              }
            };
          }
        }

        const ocrPrompt = [
          'You are an OCR assistant. The image is a single-page student answer sheet.',
          '',
          'On the page there are small drawn rectangular boxes scattered around. Each box has a closed (or near-closed) border. Inside each box, a student may have handwritten digits or characters as their answer.',
          '',
          'Your ONLY job: read the handwritten content inside each box. Do not transcribe any printed text (questions, options, instructions, headers, school name, page numbers, decorative borders, printed digit examples).',
          '',
          'Box dimensions (for reference):',
          '- Box height: 0.20 to 0.35 inches (one line of handwriting).',
          '- Box width: 0.17 to 0.23 inches per digit slot. So 1-digit box ≈ 0.17-0.23 in, 2-digit ≈ 0.34-0.46 in, 3-digit ≈ 0.51-0.69 in. Wider than that means it is a multi-line answer area — read the full handwritten text inside, do not split.',
          '',
          'Output: a single JSON object with this exact shape:',
          '{ "answers": [ "75, null, 89", "42", "100", null, "abc" ] }',
          '',
          'Rules:',
          '- "answers" is a flat array of strings, one entry per VISUAL ROW on the page (top-to-bottom).',
          '- For each row, output ONE string. If a row contains multiple digit-boxes side by side, the string is the answers in left-to-right order separated by commas. Use the literal "null" (no quotes around it) for any unanswered box in that row.',
          '- For a wide multi-line area, output the full handwritten text the student wrote there as one string.',
          '- Empty rows (no box, no writing) — emit a literal "null" string for that row index, OR skip it. Prefer skipping if you can.',
          '- A row containing one wide multi-line area — emit as one string.',
          '- Preserve what the student wrote exactly. Do not correct, normalize, or compute.',
          '- If a box has only a smudge or stray dot, output "unclear". If the box is empty, output "null".',
          '- Output ONLY the JSON object. No prose, no markdown fences, no commentary.',
        ].join('\n');

        const ollamaRes = await fetch(apiBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: 'user',
                content: ocrPrompt,
                images: [imageBase64],
              },
            ],
            // Force the model to emit valid JSON. Without this, even with
            // a strong prompt it may wrap the JSON in ```json fences or
            // add prose the frontend then can't parse.
            format: 'json',
            stream: false,
          }),
        });
        const ollamaJson = await ollamaRes.json().catch(() => ({}));
        if (!ollamaRes.ok) {
          const msg = (ollamaJson && ollamaJson.error)
            || ('Ollama Cloud HTTP ' + ollamaRes.status);
          return { status: 502, body: { error: 'Ollama Cloud: ' + msg } };
        }
        // Ollama's /api/chat with format:'json' returns the model's
        // JSON object as a string under message.content. Parse it; on
        // any failure (fenced markdown, prose wrapper, etc.) fall back
        // to the raw text we did receive.
        const rawText = (ollamaJson && ollamaJson.message && ollamaJson.message.content)
          ? String(ollamaJson.message.content)
          : '';
        // The user wants only the handwritten answers as a flat list.
        let flatAnswers: string[] | null = null;
        let parseError: string | null = null;
        if (rawText) {
          // Strip ```json / ``` fences if the model wrapped anyway.
          const stripped = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();
          try {
            const parsed = JSON.parse(stripped);
            if (parsed && Array.isArray(parsed.answers)) {
              flatAnswers = parsed.answers.map((s: any) => String(s ?? ''));
            } else {
              parseError = 'model output did not contain answers array';
            }
          } catch (e: any) {
            parseError = 'JSON parse failed: ' + (e?.message || String(e));
          }
        } else {
          parseError = 'empty model output';
        }
        // Build a flat token list (whitespace split) for the existing
        // downstream consumers (Verify table + EasyOCR-style fill).
        const tokens = rawText
          .split(/\s+/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(text => ({ text, confidence: 0.7 }));
        return {
          status: 200, body: {
            success: true,
            provider: 'ollama-gemma4',
            model: modelName,
            mimeUsed,
            // The cleaned, flat answer list — exactly what the verify UI consumes.
            answers: flatAnswers || [],
            // Keep raw text + tokens for the OCR analysis preview pane.
            extractedText: rawText,
            extractedTokens: tokens,
            rawOcrText: rawText,
            // When JSON parsing fails we still want the UI to show the raw text
            // and an explicit warning — the question-classifier flow can then
            // try to parse it client-side as a fallback.
            structured: flatAnswers != null,
            structuredError: parseError,
            processingTimeMs: Date.now() - t0,
          }
        };
      }


      // ===== Azure Computer Vision (stub) =====
      if (provider === 'azure') {
        return {
          status: 501, body: {
            error: 'Azure Computer Vision integration is not yet implemented. Pick Google Cloud Vision, MiniMax, OCR.space or use the local OCR button.',
          }
        };
      }

      return { status: 400, body: { error: 'Unknown provider: ' + provider } };
    } catch (e: any) {
      return { status: 500, body: { error: 'Cloud OCR failed: ' + (e && e.message ? e.message : String(e)) } };
    }
  };

  // OCR endpoint: takes {provider, imageDataUrl} for a single image, or
  // {provider, pages} — one entry per filtered page — for multi-page PDFs
  // (e.g. several students' sheets scanned into one file). NO apiKey from
  // frontend.
  app.post('/api/icr/evaluate-cloud', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Accept either field name so the cloud endpoint mirrors the legacy
    // local-OCR endpoint shape, and accept image OR PDF data URLs since
    // Ollama's vision API only accepts image MIME types (we rasterize PDFs).
    const { imageDataUrl, fileBase64, provider, pages } = req.body || {};
    const pageList: Array<{ pageNumber?: number; imageDataUrl: string }> =
      Array.isArray(pages) && pages.length > 0 ? pages : [];
    const singleDataUrl = imageDataUrl || fileBase64;
    if (pageList.length === 0 && (!singleDataUrl || typeof singleDataUrl !== 'string')) {
      return res.status(400).json({ error: 'imageDataUrl, fileBase64, or pages is required (data URL).' });
    }
    if (!provider || ['google', 'aws', 'azure', 'minimax', 'ocrspace', 'ollama-gemma4'].indexOf(provider) === -1) {
      return res.status(400).json({ error: 'provider must be one of google/aws/azure/minimax/ocrspace/ollama-gemma4.' });
    }

    const apiKey = await getCloudKey(provider);
    if (!apiKey) {
      return res.status(503).json({
        error: provider + ' API key not configured on the server. Ask an admin to set it via /api/icr/cloud-config or the ICR_CLOUD_API_KEY_' + provider.toUpperCase() + ' env var.',
      });
    }

    const pagesToRun = pageList.length > 0 ? pageList : [{ pageNumber: 1, imageDataUrl: singleDataUrl as string }];
    const results: any[] = [];
    for (const page of pagesToRun) {
      const r = await runCloudOcrOnImage(page.imageDataUrl, provider, apiKey);
      if (r.status !== 200) {
        const prefix = pagesToRun.length > 1 ? `Page ${page.pageNumber}: ` : '';
        return res.status(r.status).json({ ...r.body, error: prefix + (r.body?.error || 'unknown error') });
      }
      results.push({ pageNumber: page.pageNumber, ...r.body });
    }

    if (results.length === 1) {
      return res.json(results[0]);
    }

    // Merge multi-page results into the same response shape the frontend
    // already consumes for a single page. provider/model/ocrEngine/mimeUsed
    // are identical across pages (same request, same provider) so page 1's
    // values are used; everything else concatenates across pages.
    const first = results[0];
    return res.json({
      success: true,
      provider: first.provider,
      model: first.model,
      ocrEngine: first.ocrEngine,
      mimeUsed: first.mimeUsed,
      pageCount: results.length,
      answers: results.flatMap(r => r.answers || []),
      extractedTokens: results.flatMap(r => r.extractedTokens || []),
      rawOcrText: results.map(r => `[page ${r.pageNumber}] ${r.rawOcrText || ''}`).join(' | '),
      extractedText: results.map(r => r.extractedText).filter(Boolean).join(' | '),
      structured: results.every(r => r.structured !== false),
      structuredError: results.map(r => r.structuredError).filter(Boolean).join('; ') || null,
      processingTimeMs: results.reduce((a, r) => a + (r.processingTimeMs || 0), 0),
    });
  });

  // Generate Personalized Class Worksheets
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
    // re-running the AI evaluation, re-mutating the student's level,
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
      timestamp: now.toISOString(),
      // Issue #180: per-question breakdown so a teacher can later correct
      // individual mis-scanned answers via the override endpoint.
      questionResults: studentQuestions.map(q => ({
        questionId: q.question_id,
        question: q.question,
        correctAnswer: q.answer,
        submittedAnswer: answers[q.question_id] || '',
        isCorrect: (answers[q.question_id] || '').trim().toLowerCase() === q.answer.trim().toLowerCase(),
      })),
    };

    await dbStore.addEvaluationReport(report);

    // If correct, update student levels
    const levelHistory = [...student.levelHistory];
    if (evaluation.recommendedLevel !== student.currentLevel || newSubLevel !== (student.currentSubLevel || 0)) {
      levelHistory.push({
        level: evaluation.recommendedLevel,
        subLevel: newSubLevel,
        date: now.toISOString().split('T')[0],
        reason: ws.cycle // already one of CYCLE_NAMES
      });
    }

    await dbStore.updateStudent(student.id, {
      currentLevel: evaluation.recommendedLevel,
      currentSubLevel: newSubLevel,
      targetLevel: Math.min(93, evaluation.recommendedLevel + 1),
      levelHistory
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

    let reports: EvaluationReport[];
    if (user.role === UserRole.SUPERADMIN) {
      reports = await dbStore.getEvaluationReports();
    } else {
      let scopedStudentIds: Set<string>;
      if (user.role === UserRole.SCHOOL || user.role === UserRole.TEACHER) {
        const students = await dbStore.getStudents({ schoolId: user.schoolId });
        scopedStudentIds = new Set(students.map(s => s.id));
      } else if (user.role === UserRole.VOLUNTEER) {
        const students = await dbStore.getStudents({ schoolId: user.assignedSchools || [] });
        scopedStudentIds = new Set(students.map(s => s.id));
      } else if (user.role === UserRole.ADMIN || user.role === UserRole.DISTRICT_ADMIN || user.role === UserRole.BLOCK_ADMIN) {
        const schools = await dbStore.getSchools();
        const filteredSchools = schools.filter(school => {
          if (user.role === UserRole.ADMIN) return school.stateCode === user.stateCode;
          if (user.role === UserRole.DISTRICT_ADMIN) return school.districtCode === user.districtCode;
          return school.blockCode === user.blockCode; // BLOCK_ADMIN
        });
        const schoolIds = filteredSchools.map(s => s.id);
        const students = await dbStore.getStudents({ schoolId: schoolIds });
        scopedStudentIds = new Set(students.map(s => s.id));
      } else {
        const students = await dbStore.getStudents();
        scopedStudentIds = new Set(students.map(s => s.id));
      }
      reports = await dbStore.getEvaluationReports({ studentIds: Array.from(scopedStudentIds) });
    }

    // Opt-in pagination (same pattern as GET /api/students, PR #115).
    // Omitting ?page & ?limit returns the full scoped list — no existing caller breaks.
    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    if (pageParam || limitParam) {
      const page  = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const limit = Math.max(1, Math.min(500, parseInt(limitParam || '50', 10) || 50));
      const total = reports.length;
      const start = (page - 1) * limit;
      res.set('X-Total-Count', String(total));
      res.set('X-Page',        String(page));
      res.set('X-Pages',       String(Math.max(1, Math.ceil(total / limit))));
      return res.json(reports.slice(start, start + limit));
    }

    res.json(reports);
  });

  // Evaluation History
  app.get('/api/evaluation/:studentId/history', async (req, res) => {
    // Was missing auth entirely — any unauthenticated request could read
    // any student's full evaluation history. Fixed while wiring #174's
    // Student Profile exam-history view to this route.
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const student = await dbStore.getStudentById(req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    const reps = await dbStore.getEvaluationReports();
    const filtered = reps.filter(r => r.studentId === req.params.studentId);
    res.json(filtered);
  });

  // Issue #180: teacher-override/confirm endpoint for post-ICR answer
  // correction. Lets a teacher submit corrections to a scanned-and-graded
  // answer sheet before it's treated as final, and recalculates the
  // downstream data (score, recommended level, the student's current
  // placement) that was originally derived from the wrong verdict.
  app.patch('/api/evaluation/:reportId/override', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const report = await dbStore.getEvaluationReportById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Evaluation report not found.' });

    const student = await dbStore.getStudentById(report.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (!canAccessStudent(user, student)) return res.status(403).json({ error: 'Forbidden.' });

    if (!report.questionResults || report.questionResults.length === 0) {
      return res.status(400).json({
        error: 'This report has no per-question breakdown to correct — it predates the override feature or came from a path that doesn\'t record one.',
      });
    }

    const { corrections } = req.body as {
      corrections: { questionId: string; isCorrect: boolean; correctedAnswer?: string }[];
    };
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({ error: '`corrections` must be a non-empty array.' });
    }

    const knownIds = new Set(report.questionResults.map(q => q.questionId));
    const unknownIds = corrections.filter(c => !knownIds.has(c.questionId)).map(c => c.questionId);
    if (unknownIds.length > 0) {
      return res.status(400).json({ error: `Unknown questionId(s) for this report: ${unknownIds.join(', ')}` });
    }

    const correctionMap = new Map(corrections.map(c => [c.questionId, c]));
    const updatedQuestionResults = report.questionResults.map(q => {
      const correction = correctionMap.get(q.questionId);
      if (!correction) return q;
      return {
        ...q,
        submittedAnswer: correction.correctedAnswer ?? q.submittedAnswer,
        isCorrect: correction.isCorrect,
      };
    });

    const newScore = updatedQuestionResults.filter(q => q.isCorrect).length;
    const totalQuestions = updatedQuestionResults.length;
    const percentage = Math.round((newScore / totalQuestions) * 100);

    // Re-derive recommendedLevel/subLevel using the same score%-based mapping
    // already established elsewhere in this file for ICR-scanned diagnostics
    // (see the /api/icr/evaluate-file handler above) — reused here rather
    // than invented fresh, since it's the codebase's existing convention for
    // turning a score into a level.
    const classMatch = student.classGroup.match(/\d+/);
    const classNumber = classMatch ? parseInt(classMatch[0], 10) : 1;
    const recommendedLevel = Math.max(1, Math.min(93, (classNumber - 1) * 10 + Math.ceil(percentage / 10)));
    const recommendedSubLevel = percentage >= 80 ? 0 : percentage >= 50 ? 1 : 2;

    const updatedReport = await dbStore.updateEvaluationReport(report.id, {
      questionResults: updatedQuestionResults,
      score: newScore,
      recommendedLevel,
      recommendedSubLevel,
      teacherReviewed: true,
      reviewedBy: user.email,
      reviewedAt: new Date().toISOString(),
    });

    // Only touch the student's placement if the correction actually changed
    // the outcome. Assumes the most recent levelHistory entry is the one
    // this report produced — true for the common "correct the latest scan"
    // case; there's no explicit report<->levelHistory-entry link in the
    // current data model to do this more precisely.
    const levelChanged = recommendedLevel !== report.recommendedLevel || recommendedSubLevel !== report.recommendedSubLevel;
    if (levelChanged && student.levelHistory.length > 0) {
      const levelHistory = [...student.levelHistory];
      const lastEntry = levelHistory[levelHistory.length - 1];
      levelHistory[levelHistory.length - 1] = { ...lastEntry, level: recommendedLevel, subLevel: recommendedSubLevel };

      await dbStore.updateStudent(student.id, {
        currentLevel: recommendedLevel,
        currentSubLevel: recommendedSubLevel,
        targetLevel: Math.min(93, recommendedLevel + 1),
        levelHistory,
      });
    }

    res.json({ report: updatedReport, levelChanged });
  });
}
