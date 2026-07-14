import puppeteer from 'puppeteer';
import { getAdapter, MAX_SETS_PER_PAGE_LOAD } from './classAdapters';

const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH || undefined;

export interface RenderedResult {
  index: number;
  pdfBase64: string;
  masterJson: any;
  csv: string;
  coordsCaptured: boolean;
}

export async function renderBatch(
  classLevel: string,
  count: number,
  onProgress?: (done: number, total: number) => void,
  extraOptions?: { levelId?: number; subIdx?: number }
): Promise<RenderedResult[]> {
  const adapter = getAdapter(classLevel);

  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer.");
  }
  if (count > MAX_SETS_PER_PAGE_LOAD) {
    throw new Error(
      `count (${count}) exceeds the ${MAX_SETS_PER_PAGE_LOAD}-set ceiling baked into the worksheet generator. Split into multiple batches.`
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });

    page.on("pageerror", (err: any) => {
      console.error(`[worksheetRenderer:${classLevel}] page error:`, err.message);
    });

    const fileUrl = `file://${adapter.file}`;
    await page.goto(fileUrl, { waitUntil: "load", timeout: 60000 });

    // The page auto-generates a default set of sample sets on load.
    // Rebuild the in-memory array to exactly the size we need.
    if (classLevel === "LEVEL_PERSONALIZED") {
      const levelId = extraOptions?.levelId || 1;
      const subIdx = extraOptions?.subIdx || 0;
      await page.evaluate(new Function('levelId', 'subIdx', 'count', 'window.generateSetsForLevelAndSublevel(levelId, subIdx, count)') as any, levelId, subIdx, count);
    } else {
      await page.evaluate(new Function('n', 'window.generateSets(n)') as any, count);
    }

    const evaluateFnStr = `async function({ setIndex, classLevel: cl, pdfFn, pdfFnArgs, pdfFnReturnsCoords }) {
      function blobToBase64(blob) {
        return new Promise(function(resolve, reject) {
          const reader = new FileReader();
          reader.onloadend = function() {
            const resStr = reader.result;
            const commaIdx = resStr.indexOf(",");
            resolve(resStr.slice(commaIdx + 1));
          };
          reader.onerror = function(err) {
            reject(err);
          };
          reader.readAsDataURL(blob);
        });
      }

      const fn = window[pdfFn];
      if (typeof fn !== "function") {
        throw new Error("window." + pdfFn + " is not exposed on this page.");
      }

      const raw = await fn(...pdfFnArgs);
      const pdfBlob = pdfFnReturnsCoords ? raw.pdfBlob : raw;
      const coords = pdfFnReturnsCoords ? raw.coords : null;

      const pdfBase64 = await blobToBase64(pdfBlob);

      let masterJson;
      if (cl === "CLASS_1" || cl === "CLASS_2") {
        masterJson = window.buildMasterJSON(setIndex, coords);
      } else if (cl === "CLASS_3" || cl === "LEVEL_PERSONALIZED") {
        masterJson = window.buildMasterJSON(setIndex, setIndex);
      } else if (cl === "CLASS_4") {
        masterJson = window.buildMasterJSON(setIndex, setIndex, cl);
      } else {
        throw new Error("Unhandled classLevel \\"" + cl + "\\" for buildMasterJSON.");
      }

      const csv = window.buildCSV(setIndex, setIndex);

      return { pdfBase64, masterJson, csv, coordsCaptured: Boolean(coords) };
    }`;

    const results: RenderedResult[] = [];
    for (let i = 1; i <= count; i += 1) {
      const rendered = await page.evaluate(
        new Function('obj', 'return (' + evaluateFnStr + ')(obj)') as any,
        {
          setIndex: i,
          classLevel,
          pdfFn: adapter.pdfFn,
          pdfFnArgs: adapter.pdfFnArgs(i),
          pdfFnReturnsCoords: adapter.pdfFnReturnsCoords,
        }
      );

      results.push({ index: i, ...rendered });
      if (typeof onProgress === "function") {
        onProgress(i, count);
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}
