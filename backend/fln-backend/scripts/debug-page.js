/**
 * scripts/debug-page.js
 *
 * Standalone diagnostic: loads app/index.html in headless Chromium,
 * prints every console message / page error, then reports which of the
 * globals renderWorksheet.js depends on are actually defined.
 *
 * Run with:
 *   node scripts/debug-page.js
 */
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');

const APP_URL = pathToFileURL(path.join(__dirname, '..', 'app', 'index.html')).href;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`[console.${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  page.on('requestfailed', (req) =>
    console.log('[requestfailed]', req.url(), req.failure() && req.failure().errorText)
  );

  console.log('Loading', APP_URL, '...');
  await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 60000 }).catch((e) =>
    console.log('[goto error]', e.message)
  );

  const report = await page.evaluate(() => ({
    ICONS: typeof ICONS,
    GENERATORS: typeof GENERATORS,
    LEVELS: Array.isArray(LEVELS) ? `array(${LEVELS.length})` : typeof LEVELS,
    levelSublevelIds: typeof levelSublevelIds,
    buildWorksheet: typeof buildWorksheet,
    buildAnswerKeyForSet: typeof buildAnswerKeyForSet,
    buildCleanAnswerKey: typeof buildCleanAnswerKey,
    captureCoords: typeof captureCoords,
    makeHiddenContainer: typeof makeHiddenContainer,
    html2canvas: typeof html2canvas,
    jspdf: typeof jspdf,
    JSZip: typeof JSZip
  }));

  console.log('\n--- Global availability report ---');
  console.table(report);

  await browser.close();
})();
