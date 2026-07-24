import puppeteer, { Browser } from 'puppeteer';

// Single place to launch headless Chrome for PDF generation.
//
// By default Puppeteer uses its own managed Chrome (installed with
// `npx puppeteer browsers install chrome`, in ~/.cache/puppeteer). Set
// CHROME_EXECUTABLE_PATH to point at a specific Chrome/Chromium binary instead.
//
// If the browser can't start (not installed, or missing system libraries), we
// throw one clear, actionable error instead of a raw Puppeteer stack trace.
export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;
  try {
    return await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (err: any) {
    throw new Error(
      'Failed to launch Chrome for PDF generation. Install the browser with ' +
        '`npx puppeteer browsers install chrome` (and its system libraries), or set ' +
        'CHROME_EXECUTABLE_PATH to a valid Chrome binary. Original error: ' +
        (err?.message || String(err)),
    );
  }
}
