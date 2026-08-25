import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { dbStore, EvaluationReport, Student, AnswerSubmission, UserRole, CYCLE_NAMES, dedupeQuestionsById } from '../db';
import { getAuthUser, canAccessStudent } from '../auth';
import { evaluateAIWorksheet } from '../gemini';
import { PYTHON_BIN, AI_SERVICES_DIR } from '../config';
import { CURRICULUM_MAPPING } from '../config/curriculumMap';
import { directPrerequisites, describeConcept } from '../competencyPrerequisites';

export function registerEvaluationRoutes(app: express.Express) {

  // =========================================================================
  // ICR via Ollama Gemma 4 (single OCR provider)
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
    // Single OCR model: ollama-gemma4. Other providers (google, aws,
    // azure, minimax, ocrspace) are no longer supported.
    if (provider !== 'ollama-gemma4') {
      return res.status(400).json({ error: 'provider must be "ollama-gemma4".' });
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
    const providers = ['ollama-gemma4'];
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
    apiKey: string,
    expectedCount?: number
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
        // rasterized to PNG first. Multi-page PDFs are rasterized to a
        // single output directory (one PNG per page) and ALL pages are
        // passed to Ollama in the `images` array. The previous version
        // only sent page 1; the OCR prompt explicitly says "process ALL
        // pages together" so the model expects multiple images.
        const mimeUsedIn: string = (dataUrl.indexOf('data:') === 0)
          ? dataUrl.slice(5, dataUrl.indexOf(';'))
          : 'image/jpeg';
        let imageBase64s: string[];
        let mimeUsed: string;
        if (mimeUsedIn === 'application/pdf') {
          try {
            const { execFileSync } = await import('child_process');
            const scratchDir = path.join(AI_SERVICES_DIR, 'scratch');
            fs.mkdirSync(scratchDir, { recursive: true });
            const stamp = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            const pdfPath = path.join(scratchDir, `cloud_pdf_${stamp}.pdf`);
            // --all-pages rasterizes every page into this directory; the
            // script returns {"success": true, "pages": [...]}.
            const pagesDir = path.join(scratchDir, `cloud_pdf_${stamp}_pages`);
            fs.writeFileSync(pdfPath, Buffer.from(base64Body, 'base64'));
            const scriptPath = path.join(AI_SERVICES_DIR, 'scripts', 'pdf_rasterize.py');
            const childOut = execFileSync(
              PYTHON_BIN,
              [scriptPath, pdfPath, pagesDir, '--all-pages'],
              {
                cwd: AI_SERVICES_DIR,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
                timeout: 60000,
                maxBuffer: 32 * 1024 * 1024,
              }
            );
            const pdfJson = JSON.parse(childOut.toString());
            if (!pdfJson.success || !Array.isArray(pdfJson.pages) || pdfJson.pages.length === 0) {
              try { fs.rmSync(pdfPath, { force: true }); } catch { /* noop */ }
              try { fs.rmSync(pagesDir, { recursive: true, force: true }); } catch { /* noop */ }
              return {
                status: 500, body: {
                  error: 'Cloud OCR (OLLAMA-GEMMA4) could not rasterize PDF: ' + (pdfJson.error || 'unknown'),
                }
              };
            }
            const pagePaths: string[] = pdfJson.pages.map((p: any) => p.output_path).filter(Boolean);
            // Safety caps: refuse to OCR absurdly long PDFs.
            const MAX_PAGES = 10;
            if (pagePaths.length > MAX_PAGES) {
              try { fs.rmSync(pdfPath, { force: true }); } catch { /* noop */ }
              try { fs.rmSync(pagesDir, { recursive: true, force: true }); } catch { /* noop */ }
              return {
                status: 400, body: {
                  error: `PDF has ${pagePaths.length} pages; max is ${MAX_PAGES}. Split the file or scan fewer sheets at once.`,
                }
              };
            }
            // Read each page PNG as base64 and concatenate. Each page is
            // 300 DPI ~1-3 MB on disk → ~1.5-4 MB base64.
            imageBase64s = pagePaths.map((p: string) => fs.readFileSync(p).toString('base64'));
            // Safety cap on cumulative base64 size — Ollama's /api/chat
            // accepts large request bodies but we shouldn't push 50+ MB.
            const totalBase64Bytes = imageBase64s.reduce((n, s) => n + s.length, 0);
            const MAX_TOTAL_BASE64 = 24 * 1024 * 1024; // ~24 MB base64 ≈ 18 MB binary
            if (totalBase64Bytes > MAX_TOTAL_BASE64) {
              try { fs.rmSync(pdfPath, { force: true }); } catch { /* noop */ }
              try { fs.rmSync(pagesDir, { recursive: true, force: true }); } catch { /* noop */ }
              return {
                status: 413, body: {
                  error: `PDF too large to OCR (${(totalBase64Bytes / 1024 / 1024).toFixed(1)} MB base64 across ${pagePaths.length} pages; max ${MAX_TOTAL_BASE64 / 1024 / 1024} MB). Reduce scan resolution or split the file.`,
                }
              };
            }
            mimeUsed = 'image/png';
            // Cleanup the per-page PNGs and the source PDF now that we
            // have them in memory. Done before the Ollama POST so we
            // don't leak disk if the request hangs.
            try { fs.rmSync(pdfPath, { force: true }); } catch { /* noop */ }
            try { fs.rmSync(pagesDir, { recursive: true, force: true }); } catch { /* noop */ }
          } catch (e: any) {
            return {
              status: 500, body: {
                error: 'Cloud OCR (OLLAMA-GEMMA4) PDF rasterization failed: ' + (e?.message || String(e)),
              }
            };
          }
        } else {
          // Image upload (PNG/JPEG/WebP). Pass through unchanged.
          imageBase64s = [base64Body];
          mimeUsed = mimeUsedIn;
        }

        const expectedCountLines = (typeof expectedCount === 'number' && expectedCount > 0)
          ? [
              '',
              '════════════════════════════════════',
              'EXPECTED ROW COUNT',
              '════════════════════════════════════',
              `This answer sheet has EXACTLY ${expectedCount} questions in total, across all pages.`,
              `Your output MUST contain EXACTLY row_1 through row_${expectedCount} — no more, no fewer.`,
              'If you count more or fewer candidate rows than this while reading the page, re-check your',
              'row segmentation (a merged multi-part question is still ONE row; do not split a single',
              'question into two rows just to make the count match, and do not merge two distinct',
              `questions into one row either). The count of ${expectedCount} is ground truth from the`,
              'answer key this sheet was generated from — trust it over your own row count if they conflict,',
              'and re-scan the page for a row you may have skipped or merged before giving up.',
              '',
            ]
          : [];

        const ocrPrompt = [
          'You are an answer-sheet extraction assistant for a primary-school FLN assessment (Grades 2–5).',
          'You will receive ONE OR MORE scanned page images belonging to a SINGLE student\'s answer sheet.',
          'Pages may be for Class 2, 3, 4, or 5 — the sheet can span 2 or more pages.',
          '',
          'Process ALL pages together, top to bottom, page by page.',
          'Your final output must be ONE unified JSON object with rows numbered continuously ',
          'across all pages (row 1 on page 1, row 6 on page 2, etc. — never restart at 1).',
          ...expectedCountLines,
          '',
          '════════════════════════════════════',
          'MULTI-PAGE INSTRUCTIONS',
          '════════════════════════════════════',
          '- Process pages in the order they are given (Page 1, Page 2, … Page N).',
          '- Row numbering is continuous across all pages. Do NOT restart row count per page.',
          '- If a page is blank or unreadable, do NOT skip it. Instead, output an error entry ',
          '  for every expected row on that page using this format:',
          '  "row_N": { "error": "Page unreadable — could not extract answer. Please check scan quality." }',
          '- If only part of a row is unreadable (e.g. torn edge, heavy shadow), output what ',
          '  you could read and mark the unreadable slot as "unclear".',
          '- Process ALL pages before writing any output.',
          '',
          '════════════════════════════════════',
          'ROW DETECTION RULES',
          '════════════════════════════════════',
          'A "row" is one horizontal band of student-written content on the page.',
          '- Each question or sub-question that occupies its own horizontal line = one row.',
          '- If a question has multiple answer slots side by side on the same line, they all ',
          '  belong to the same row — output them comma-separated, left to right.',
          '- If a question spans multiple printed lines (e.g. a match-the-following block or a ',
          '  multi-line pattern), treat the entire block as ONE row.',
          '- Blank printed lines with no student writing = null for that row.',
          '',
          '════════════════════════════════════',
          'WHAT TO CAPTURE (student output only)',
          '════════════════════════════════════',
          '',
          '1. BOXES / BLANKS — Handwritten digits, letters, or words inside rectangular/square ',
          '   boxes or on blank lines. Read exactly what the student wrote. Do not correct or normalise.',
          '',
          '2. FILL-IN-THE-BLANK (no box) — Handwritten characters written on a printed underline ',
          '   or in a gap between printed words. Each gap = one slot; read left to right.',
          '',
          '3. COMPARISON SYMBOLS — Handwritten >, <, or = placed between two numbers or objects.',
          '   Output the symbol exactly as written.',
          '',
          '4. MATCH-THE-FOLLOWING — Lines drawn by the student connecting left column to right column.',
          '   Output as: "A→3, B→1, C→2" (use printed labels). Treat the full block as one row.',
          '',
          '5. PATTERN COMPLETION — Printed sequence with blank slots. Output only what the student ',
          '   wrote or drew in the blank slots, left to right, comma-separated.',
          '   If the student drew a shape, name it (see rule 7).',
          '',
          '6. CIRCLED ANSWER (single item) — Output the label or text of the circled item.',
          '   If the item has no label and there are two images side by side, output "left" or "right" ',
          '   based on horizontal position on the page.',
          '',
          '7. DRAWN / IDENTIFIED SHAPES — Identify by common name:',
          '   heart, star, circle, square, triangle, rectangle, oval, diamond, arrow, ',
          '   or "unknown shape" if unrecognisable.',
          '',
          '8. LARGEST / SMALLEST / MORE / LESS (two-image questions) — Output "left" or "right" ',
          '   for whichever image the student circled. If ambiguous, output "unclear".',
          '',
          '9. EMPTY / UNANSWERED — No writing at all → null. Smudge or stray mark only → "unclear".',
          '',
          '════════════════════════════════════',
          'WHAT NOT TO CAPTURE',
          '════════════════════════════════════',
          '- Any printed text: instructions, question numbers, option labels, example digits, ',
          '  decorative borders, school name, page numbers, class/grade labels.',
          '- Printed images or diagrams (reference them only to determine left vs right ',
          '  for a circled answer).',
          '',
          '════════════════════════════════════',
          'OUTPUT FORMAT',
          '════════════════════════════════════',
          'Return a single JSON object with:',
          '- A "_meta" key describing pages received and any page-level issues.',
          '- One key per row: "row_1", "row_2", … "row_N" — continuous across all pages.',
          '',
          'Each row value is either:',
          '- A string (one answer or comma-separated answers for multi-slot rows)',
          '- null (row exists but student left it blank)',
          '- An object with an "error" key (row belongs to an unreadable page)',
          '',
          'Example (2-page sheet, page 2 unreadable):',
          '{',
          '  "_meta": {',
          '    "total_pages_received": 2,',
          '    "pages_processed": [1],',
          '    "page_errors": {',
          '      "page_2": "Unreadable — could not extract answers. Please check scan quality."',
          '    }',
          '  },',
          '  "row_1": "7, null, 9",',
          '  "row_2": ">",',
          '  "row_3": "left",',
          '  "row_4": "A→3, B→1, C→2",',
          '  "row_5": "circle, square, circle",',
          '  "row_6": "heart",',
          '  "row_7": "unclear",',
          '  "row_8": null,',
          '  "row_9": { "error": "Page unreadable — could not extract answer. Please check scan quality." },',
          '  "row_10": { "error": "Page unreadable — could not extract answer. Please check scan quality." }',
          '}',
          '',
          'Rules:',
          '- Output ONLY the JSON object. No prose, no markdown fences, no commentary.',
          '- Preserve exactly what the student wrote. Do not compute, correct, or normalise.',
          '- For LEFT/RIGHT answers, base the decision purely on horizontal position on that page.',
          '- If you cannot confidently read a character, output "unclear" — do not guess.',
          '- Never invent rows that do not exist on the physical sheet.',
          '- Process ALL pages before writing any output.',
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
                // Multiple images = multiple pages of the same student's
                // answer sheet. The prompt asks for a single unified
                // JSON object with row numbering continuous across pages.
                images: imageBase64s,
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
        // Parse the model's row_N schema (new prompt) — keep the existing
                // flat `answers[]` shape stable for downstream consumers (the
                // IcrTwoStageScan → IcrScanner pipeline reads answers[] by index).
                // We derive flatAnswers from sorted row_N keys so row 1, row 2,
                // ... row N come out in order, and skip rows whose value is an
                // { error: ... } object (the model emits those for unreadable
                // pages).
                let flatAnswers: string[] | null = null;
                let parseError: string | null = null;
                let pageErrors: Record<string, string> | null = null;
                let meta: any = null;
                if (rawText) {
                  // Strip ```json / ``` fences if the model wrapped anyway.
                  const stripped = rawText
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/\s*```\s*$/i, '')
                    .trim();
                  try {
                    const parsed = JSON.parse(stripped);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                      meta = parsed._meta ?? null;
                      pageErrors = (meta && typeof meta.page_errors === 'object') ? meta.page_errors : null;
                      // Collect every "row_N" key in numeric order. Anything that
                      // isn't a row_N key is ignored — the prompt's spec says row_1
                      // ... row_N are the only data entries; _meta is metadata.
                      const rowKeys = Object.keys(parsed)
                        .filter(k => /^row_\d+$/.test(k))
                        .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
                      if (rowKeys.length > 0) {
                        flatAnswers = rowKeys.map(k => {
                          const v = parsed[k];
                          if (v === null || v === undefined) return '';
                          if (typeof v === 'object' && v && 'error' in v) {
                            // Per-page error — emit a sentinel token so the verify
                            // UI can show it. Use the literal "unclear" so the
                            // existing post-processing handles it consistently.
                            return 'unclear';
                          }
                          return String(v);
                        });
                      } else {
                        parseError = 'model output did not contain any row_N keys';
                      }
                    } else {
                      parseError = 'model output was not a JSON object';
                    }
                  } catch (e: any) {
                    parseError = 'JSON parse failed: ' + (e?.message || String(e));
                  }
                } else {
                  parseError = 'empty model output';
                }
        // Build a flat token list (whitespace split) for the existing
        // downstream consumers (Verify table + flat-answers fill).
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
                    // New-prompt metadata: page-level errors (e.g. unreadable pages
                    // the model couldn't read) and the model's _meta block. The UI
                    // can show a banner per error page.
                    pageErrors: pageErrors || {},
                    meta: meta || null,
                    // When JSON parsing fails we still want the UI to show the raw text
                    // and an explicit warning — the question-classifier flow can then
                    // try to parse it client-side as a fallback.
                    structured: flatAnswers != null,
                    structuredError: parseError,
                    // Issue #234: surface a row-count mismatch explicitly instead of
                    // letting the frontend silently pad/truncate. expectedCount is
                    // only present when the caller (frontend) already knew the real
                    // question count for this student's paper.
                    expectedCount: expectedCount ?? null,
                    countMismatch: (typeof expectedCount === 'number' && expectedCount > 0 && flatAnswers != null)
                      ? flatAnswers.length !== expectedCount
                      : null,
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

  // OCR endpoint: takes {provider, imageDataUrl} or {provider, fileBase64}
  // for a single image or PDF. NO apiKey from frontend. The frontend
  // sends the raw file as a single data URL; the backend rasterizes
  // PDFs to PNG before posting to Ollama (Ollama's vision API only
  // accepts image MIME types).
  app.post('/api/icr/evaluate-cloud', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { imageDataUrl, fileBase64, provider, expectedCount } = req.body || {};
    const singleDataUrl = imageDataUrl || fileBase64;
    if (!singleDataUrl || typeof singleDataUrl !== 'string') {
      return res.status(400).json({ error: 'imageDataUrl or fileBase64 is required (data URL).' });
    }
    if (provider !== 'ollama-gemma4') {
      return res.status(400).json({ error: 'provider must be "ollama-gemma4".' });
    }
    // Optional (issue #234): the caller may already know the real question
    // count for this student's paper (from the diagnostic answer key). When
    // present, it's used to tell the model exactly how many rows to expect
    // and to flag a mismatch explicitly rather than silently padding/
    // truncating downstream.
    const expectedCountNum = (typeof expectedCount === 'number' && Number.isFinite(expectedCount) && expectedCount > 0)
      ? Math.floor(expectedCount)
      : undefined;

    const apiKey = await getCloudKey(provider);
    if (!apiKey) {
      return res.status(503).json({
        error: provider + ' API key not configured on the server. Ask an admin to set it via /api/icr/cloud-config or the ICR_CLOUD_API_KEY_' + provider.toUpperCase() + ' env var.',
      });
    }

    const r = await runCloudOcrOnImage(singleDataUrl, provider, apiKey, expectedCountNum);
    return res.status(r.status).json(r.body);
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
