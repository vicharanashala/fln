const puppeteer = require('puppeteer');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_INDEX_PATH = path.resolve(__dirname, '..', 'frontend', 'public', 'worksheets', 'levels_main.html');
const APP_URL = pathToFileURL(APP_INDEX_PATH).href;

console.log('APP_INDEX_PATH:', APP_INDEX_PATH);
console.log('APP_URL:', APP_URL);

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

async function test() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  console.log('Browser launched. Opening new page...');
  const page = await browser.newPage();
  
  page.on('pageerror', (err) => {
    console.error('Page error:', err.message);
  });
  page.on('console', (msg) => {
    console.log('Console:', msg.text());
  });

  console.log('Navigating to APP_URL...');
  await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Page loaded. Checking globals...');
  
  try {
    await page.waitForFunction(REQUIRED_GLOBALS_CHECK, { timeout: 15000 });
    console.log('Globals found successfully!');
  } catch (err) {
    console.error('Globals check timed out:', err.message);
    // Print what is missing
    const missing = await page.evaluate(() => {
      return {
        buildWorksheet: typeof window.buildWorksheet,
        buildCleanAnswerKey: typeof window.buildCleanAnswerKey,
        buildAnswerKeyForSet: typeof window.buildAnswerKeyForSet,
        captureCoords: typeof window.captureCoords,
        makeHiddenContainer: typeof window.makeHiddenContainer,
        levelSublevelIds: typeof window.levelSublevelIds,
        LEVELS: typeof LEVELS,
        jspdf: typeof window.jspdf,
        html2canvas: typeof window.html2canvas,
        JSZip: typeof window.JSZip
      };
    });
    console.log('Missing report:', missing);
  }
  
  await browser.close();
}

test().catch(console.error);
