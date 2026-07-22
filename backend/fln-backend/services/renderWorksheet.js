/**
 * services/renderWorksheet.js
 *
 * Puppeteer wrapper around the UNMODIFIED browser app in app/index.html.
 *
 * Uses Puppeteer's native page.pdf() (Chrome's built-in PDF engine) instead
 * of html2canvas + jsPDF.  This is 10-50x faster and never times out, even
 * for worksheets with heavy SVG illustrations (apples, fingers, shapes).
 *
 * Flow:
 *   1. Boots a headless page that loads app/index.html.
 *   2. Calls buildWorksheet / buildCleanAnswerKey / captureCoords via
 *      page.evaluate to build the HTML and extract metadata.
 *   3. Makes the worksheet the only visible content on the page.
 *   4. Calls page.pdf() for instant, native PDF generation.
 */

const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const APP_INDEX_PATH = path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'worksheets', 'levels_main.html');
const APP_URL = pathToFileURL(APP_INDEX_PATH).href;

// We no longer require html2canvas or jsPDF to be loaded for rendering,
// but we still check they exist so the app's own buildWorksheet (which
// may reference them internally) doesn't break.
const REQUIRED_GLOBALS_CHECK = `
  typeof window.buildWorksheet === 'function' &&
  typeof window.buildCleanAnswerKey === 'function' &&
  typeof window.buildAnswerKeyForSet === 'function' &&
  typeof window.captureCoords === 'function' &&
  typeof window.makeHiddenContainer === 'function' &&
  typeof window.levelSublevelIds === 'function' &&
  typeof LEVELS !== 'undefined' &&
  Array.isArray(LEVELS) &&
  LEVELS.length > 0
`;

let browserPromise = null;

/** Launch (once) and reuse a single headless Chromium instance for the process lifetime. */
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      protocolTimeout: 120_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }
  return browserPromise;
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * Opens a fresh page loaded with the untouched app/index.html and waits
 * until every global the rest of this module depends on is ready.
 */
async function createRenderPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  page.on('pageerror', (err) => {
    console.error('[renderWorksheet] page error:', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[renderWorksheet] console.error:', msg.text());
    }
  });

  await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(REQUIRED_GLOBALS_CHECK, { timeout: 30000 });

  return page;
}

/**
 * Reads LEVELS + levelSublevelIds directly from the loaded app to resolve
 * a requested sublevelId into concrete subIdx values to render.
 */
async function resolveSublevels(page, levelId, sublevelId) {
  return page.evaluate(
    ({ levelId, sublevelId }) => {
      const level = LEVELS.find((l) => l.id === levelId);
      if (!level) return null;
      const ids = levelSublevelIds(level);
      if (!sublevelId || sublevelId === 'all') {
        return {
          levelTitle: level.title,
          slug: level.slug,
          sublevelIds: ids,
          subIdxs: ids.map((_, i) => i)
        };
      }
      const idx = ids.indexOf(sublevelId);
      if (idx === -1) {
        return { levelTitle: level.title, slug: level.slug, sublevelIds: [], subIdxs: [] };
      }
      return { levelTitle: level.title, slug: level.slug, sublevelIds: [sublevelId], subIdxs: [idx] };
    },
    { levelId, sublevelId }
  );
}

/**
 * Two-phase render:
 *   Phase 1 (page.evaluate): Build worksheet HTML, extract metadata, make
 *           worksheet the only visible page content.  Fast — no canvas work.
 *   Phase 2 (page.pdf):      Chrome's native PDF engine renders the page.
 *           Instant, handles SVGs natively, never times out.
 */
async function evaluateRender(page, { levelId, subIdx, setNum, student }) {
  // ── Phase 1: Build HTML + extract metadata ─────────────────────────
  const metadata = await page.evaluate(
    async ({ levelId, subIdx, setNum, student }) => {
      // Set student info so the QR code embeds their name/ID
      const studentNameInput = document.getElementById('studentName');
      const studentIdInput = document.getElementById('studentId');
      if (studentNameInput) studentNameInput.value = student.studentName || '';
      if (studentIdInput) studentIdInput.value = student.studentId || student.rollNumber || '';

      const { html, answerKey, meta } = window.buildWorksheet(levelId, subIdx, setNum, null);

      const container = window.makeHiddenContainer(html);
      const wrapper = container.querySelector('.page-wrapper');
      wrapper.style.width = '794px';

      // ── Inject Reinforcement Questions ──
      // Note: batchProcessor spreads studentData into student, so it may be directly on student.
      const reinfQs = (student.studentData && student.studentData.reinforcementQuestions) || student.reinforcementQuestions;
      console.error(`[EVAL] Student ${student.studentId || student.studentName} received ${reinfQs ? reinfQs.length : 0} reinforcement questions`);
      
      if (Array.isArray(reinfQs) && reinfQs.length > 0) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'section';
        sectionDiv.setAttribute('data-sectionid', 'S_REINF');
        
        const h3 = document.createElement('h3');
        h3.textContent = 'F. Reinforcement Section';
        sectionDiv.appendChild(h3);
        
        const qList = document.createElement('div');
        qList.className = 'q-list';
        sectionDiv.appendChild(qList);
        
        const startQNo = answerKey.items.length + 1;
        
        reinfQs.forEach((q, idx) => {
          const qNum = startQNo + idx;
          const qid = 'Q' + String(qNum).padStart(4, '0');
          
          const qRow = document.createElement('div');
          qRow.className = 'q-row';
          qRow.style.marginTop = '10px';
          qRow.style.justifyContent = 'space-between';
          
          const numSpan = document.createElement('span');
          numSpan.className = 'q-num';
          numSpan.textContent = qNum + '.';
          qRow.appendChild(numSpan);
          
          const textSpan = document.createElement('span');
          textSpan.style.fontWeight = '500';
          textSpan.textContent = `[Reinforcement - ${q.topic}] ${q.question}`;
          qRow.appendChild(textSpan);
          
          const ansSpan = document.createElement('span');
          ansSpan.className = 'ans-box';
          ansSpan.style.width = '60px';
          ansSpan.setAttribute('data-omr', `${qid}-ans`);
          qRow.appendChild(ansSpan);
          
          qList.appendChild(qRow);
          
          answerKey.items.push({
            questionId: qid,
            sectionId: 'S_REINF',
            sectionName: 'Reinforcement',
            questionNo: qNum,
            answerType: q.answer_type === 'choice' ? 'mcq' : 'number',
            correctAnswer: q.answer,
            icrNote: null
          });
        });
        
        wrapper.appendChild(sectionDiv);
      }

      // Let layout settle
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Extract coords and answer key BEFORE we restyle
      const coords = window.captureCoords(wrapper);
      const cleanKey = window.buildCleanAnswerKey(answerKey);

      const ak = answerKey;
      const questionPaper = {
        setId: `L${ak.level}_${ak.slug}_set${String(ak.set).padStart(5, '0')}`,
        level: ak.level,
        levelTitle: ak.levelTitle,
        sublevel: ak.sublevel,
        setNumber: ak.set,
        generatedAt: ak.generatedAt,
        totalQuestions: ak.items.length,
        questions: ak.items.map(it => ({
          questionId: it.questionId,
          section: it.sectionId,
          sectionName: it.sectionName,
          questionNumber: it.questionNo,
          type: it.answerType
        }))
      };

      // ── Make worksheet the ONLY visible content for page.pdf() ──
      // Remove any previous render artifacts
      const oldStyle = document.getElementById('__pdf_render_style__');
      if (oldStyle) oldStyle.remove();
      const oldContainer = document.getElementById('__pdf_render_target__');
      if (oldContainer) oldContainer.remove();

      // Tag our container
      container.id = '__pdf_render_target__';

      // Inject print-isolation CSS: hide everything except our worksheet
      const style = document.createElement('style');
      style.id = '__pdf_render_style__';
      style.textContent = `
        /* Hide everything on the page */
        body > * { display: none !important; }
        /* Show only our worksheet container */
        #__pdf_render_target__ {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          overflow: visible !important;
          opacity: 1 !important;
          height: auto !important;
          width: auto !important;
          clip: auto !important;
        }
        #__pdf_render_target__ .page-wrapper {
          width: 794px !important;
          max-width: 794px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
        /* SET number footer */
        .pdf-set-footer {
          position: fixed;
          bottom: 2mm;
          right: 5mm;
          font-size: 7pt;
          font-family: sans-serif;
          color: #666;
        }
        @page { size: A4; margin: 10mm; }
        @media print {
          body > * { display: none !important; }
          #__pdf_render_target__ { display: block !important; }
        }
      `;
      document.head.appendChild(style);

      // Add SET number footer
      const footer = document.createElement('div');
      footer.className = 'pdf-set-footer';
      footer.textContent = 'SET-' + String(setNum).padStart(5, '0');
      container.appendChild(footer);

      return {
        coordsJson: coords,
        answerKeyJson: cleanKey,
        questionPaperJson: questionPaper,
        meta
      };
    },
    { levelId, subIdx, setNum, student }
  );

  // ── Phase 2: Native PDF generation (instant, no html2canvas!) ──────
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
  });

  // ── Phase 3: Clean up so the page is ready for the next render ─────
  await page.evaluate(() => {
    const target = document.getElementById('__pdf_render_target__');
    if (target) target.remove();
    const style = document.getElementById('__pdf_render_style__');
    if (style) style.remove();
  });

  return {
    pdfBuffer,
    ...metadata
  };
}

/**
 * Public entry point: renders one student/sublevel/set combination.
 * Returns Node-native Buffer + plain objects, ready to hand to storage.js.
 */
async function renderStudentSet(page, levelId, subIdx, setNum, student) {
  const result = await evaluateRender(page, { levelId, subIdx, setNum, student });
  return {
    pdfBuffer: result.pdfBuffer,
    answerKeyJson: result.answerKeyJson,
    coordsJson: result.coordsJson,
    questionPaperJson: result.questionPaperJson,
    meta: result.meta
  };
}

module.exports = {
  createRenderPage,
  resolveSublevels,
  renderStudentSet,
  closeBrowser
};
