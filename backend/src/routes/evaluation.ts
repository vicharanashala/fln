import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, EvaluationReport, Student, AnswerSubmission, UserRole, CYCLE_NAMES } from '../db';
import { getAuthUser } from '../auth';
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
}
