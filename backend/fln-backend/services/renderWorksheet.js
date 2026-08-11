/**
 * services/renderWorksheet.js
 *
 * Puppeteer wrapper around the UNMODIFIED browser app in app/index.html.
 *
 * Nothing in this file re-implements worksheet generation, PDF pagination,
 * or coordinate math. It only:
 *   1. Boots a headless page that loads app/index.html (which pulls in
 *      icons.js + html2canvas + jsPDF + jszip exactly as the browser does).
 *   2. Calls the page's own global functions (buildWorksheet,
 *      buildCleanAnswerKey, captureCoords, LEVELS, levelSublevelIds) via
 *      page.evaluate.
 *   3. Reproduces the same section-by-section html2canvas -> jsPDF loop
 *      that the original buildPdfBlob() uses, but against a local
 *      container instead of a global worksheetHTMLs[idx] array, since the
 *      server has no such array.
 *
 * If GENERATORS / LEVELS / buildWorksheet / buildPdfBlob / captureCoords /
 * buildCleanAnswerKey / levelSublevelIds ever change, this file does NOT
 * need to change (aside from the pagination-loop reproduction in step 3,
 * which must stay in sync with buildPdfBlob if that function's layout
 * math is ever edited).
 */

const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

// Load the platform's current worksheet source so batch output uses the same
// QR and layout as the interactive generator.
const APP_INDEX_PATH = path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'worksheets', 'levels_main.html');
// pathToFileURL() (not a plain 'file://' + path concat) is required for this
// to work on Windows, where paths use backslashes and drive letters — naive
// concatenation produces an invalid file:// URL and page.goto() silently
// fails to load the app, which is why the globals never appear and
// waitForFunction times out.
const APP_URL = pathToFileURL(APP_INDEX_PATH).href;

const REQUIRED_GLOBALS_CHECK = `
  typeof window.buildWorksheet === 'function' &&
  typeof window.buildCleanAnswerKey === 'function' &&
  typeof window.buildAnswerKeyForSet === 'function' &&
  typeof window.captureCoords === 'function' &&
  typeof window.makeHiddenContainer === 'function' &&
  typeof window.levelSublevelIds === 'function' &&
  typeof LEVELS !== 'undefined' &&
  Array.isArray(LEVELS) &&
  LEVELS.length > 0 &&
  window.jspdf && window.jspdf.jsPDF &&
  typeof window.html2canvas === 'function' &&
  typeof window.JSZip === 'function'
`;

let browserPromise = null;

/** Launch (once) and reuse a single headless Chromium instance for the process lifetime. */
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
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
 * One page is enough for many renders; callers decide how many pages
 * (i.e. how much concurrency) they want by calling this multiple times.
 */
async function createRenderPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Surface in-page console errors/warnings in the Node logs for debugging.
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
 * Reads LEVELS + levelSublevelIds directly from the loaded app (never
 * re-implemented here) to resolve a requested sublevelId ("all" or a
 * specific id like "26.0") into concrete subIdx values to render.
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
 * The actual worksheet+key+coords render, executed entirely inside the
 * browser context so it reuses buildWorksheet/buildCleanAnswerKey/
 * captureCoords verbatim. Only the html2canvas->jsPDF pagination loop is
 * duplicated here (copied 1:1 from the original buildPdfBlob), because
 * that function reads from a module-level array we don't have server-side.
 */
async function evaluateRender(page, { levelId, subIdx, setNum, student }) {
  return page.evaluate(
    async ({ levelId, subIdx, setNum, student }) => {
      const PDF_PAGE_W_MM = 210, PDF_PAGE_H_MM = 297, PDF_MARGIN_MM = 10;
      const PDF_CONTENT_W = PDF_PAGE_W_MM - 2 * PDF_MARGIN_MM;
      const PDF_CONTENT_H = PDF_PAGE_H_MM - 2 * PDF_MARGIN_MM;

      // The worksheet creates its own QR. Set the normal assignment fields
      // first so it contains this student's name and ID.
      const studentNameInput = document.getElementById('studentName');
      const studentIdInput = document.getElementById('studentId');
      if (studentNameInput) studentNameInput.value = student.studentName || '';
      if (studentIdInput) studentIdInput.value = student.studentId || student.rollNumber || '';
      const { html, answerKey, meta } = window.buildWorksheet(levelId, subIdx, setNum, null);

      const container = window.makeHiddenContainer(html);
      const wrapper = container.querySelector('.page-wrapper');
      wrapper.style.width = '794px';

      // Let layout settle (same double-rAF wait buildPdfBlob relies on).
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');

      async function renderEl(el, targetWidthMM) {
        const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
        const widthMM = targetWidthMM || PDF_CONTENT_W;
        const heightMM = canvas.height * (widthMM / canvas.width);
        return { canvas, heightMM, widthMM };
      }

      // Header: buildWorksheet emits either .page-header or, for a few
      // sublevels with header overrides, .worksheet-header-full. The
      // original buildPdfBlob only looks for .page-header; we fall back
      // to worksheet-header-full so those sublevels don't crash — purely
      // additive, does not change output for every other sublevel.
      const headerEl =
        wrapper.querySelector('.page-header') || wrapper.querySelector('.worksheet-header-full');

      let y = PDF_MARGIN_MM;
      const { canvas: hc, heightMM: hh } = await renderEl(headerEl, PDF_CONTENT_W);
      pdf.addImage(hc.toDataURL('image/png'), 'PNG', PDF_MARGIN_MM, y, PDF_CONTENT_W, hh);
      y += hh + 3;

      const sectionEls = Array.from(wrapper.querySelectorAll('.section'));
      for (const el of sectionEls) {
        const { canvas, heightMM } = await renderEl(el, PDF_CONTENT_W);
        let hMM = heightMM, wMM = PDF_CONTENT_W;
        if (hMM > PDF_CONTENT_H - PDF_MARGIN_MM) {
          const scale = (PDF_CONTENT_H - PDF_MARGIN_MM) / hMM;
          hMM *= scale; wMM *= scale;
        }
        if (y + hMM > PDF_PAGE_H_MM - PDF_MARGIN_MM) {
          pdf.addPage();
          y = PDF_MARGIN_MM;
        }
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', PDF_MARGIN_MM, y, wMM, hMM);
        y += hMM + 4;
      }

      pdf.setFontSize(7);
      pdf.text(`SET-${String(setNum).padStart(5, '0')}`, PDF_PAGE_W_MM - 30, PDF_PAGE_H_MM - 6);

      const coords = window.captureCoords(wrapper);
      const cleanKey = window.buildCleanAnswerKey(answerKey);
      const pdfDataUri = pdf.output('datauristring');

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

      document.body.removeChild(container);

      return {
        pdfBase64: pdfDataUri.split(',')[1],
        coordsJson: coords,
        answerKeyJson: cleanKey,
        questionPaperJson: questionPaper,
        meta
      };
    },
    { levelId, subIdx, setNum, student }
  );
}

/**
 * Public entry point: renders one student/sublevel/set combination.
 * Returns Node-native Buffer + plain objects, ready to hand to storage.js.
 */
async function renderStudentSet(page, levelId, subIdx, setNum, student) {
  const result = await evaluateRender(page, { levelId, subIdx, setNum, student });
  return {
    pdfBuffer: Buffer.from(result.pdfBase64, 'base64'),
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
