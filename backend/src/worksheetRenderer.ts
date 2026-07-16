import puppeteer from 'puppeteer';
import { getAdapter, MAX_SETS_PER_PAGE_LOAD } from './classAdapters';

const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH || undefined;

export interface RenderedResult {
  index: number;
  pdfBase64: string;
  masterJson: any;
  csv: string;
  coordsCaptured: boolean;
  coords: any;
  questionPaperJson?: any;
}

export async function renderBatch(
  classLevel: string,
  count: number,
  onProgress?: (done: number, total: number) => void,
  extraOptions?: { levelId?: number; subIdx?: number },
  studentIdentities?: Array<{ name: string; studentId?: string; rollNo?: string }>
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
  if (studentIdentities && studentIdentities.length !== count) {
    throw new Error("studentIdentities must contain one entry for every generated worksheet.");
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
      let coords = pdfFnReturnsCoords ? raw.coords : null;
      if (!coords && typeof window.captureCoords === "function") {
        const coordTarget = document.querySelector("#ws-" + setIndex + " [data-pageid]") ||
          document.querySelector("#ws-" + setIndex + " .page-wrapper") ||
          document.querySelector("#ws-" + setIndex + " .page");
        if (coordTarget) coords = window.captureCoords(coordTarget);
      }

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

      let questionPaperJson;
      if (typeof window.buildQuestionPaperJSON === "function") {
        if (cl === "CLASS_1" || cl === "CLASS_2") {
          questionPaperJson = window.buildQuestionPaperJSON(setIndex, coords);
        } else if (cl === "CLASS_3") {
          questionPaperJson = window.buildQuestionPaperJSON(setIndex, setIndex);
        } else if (cl === "CLASS_4") {
          questionPaperJson = window.buildQuestionPaperJSON(setIndex, setIndex, cl);
        }
      }

      if (coords) masterJson = Object.assign({}, masterJson, { coords });
      return { pdfBase64, masterJson, csv, coordsCaptured: Boolean(coords), coords, questionPaperJson };
    }`;

    const results: RenderedResult[] = [];
    for (let i = 1; i <= count; i += 1) {
      // QR codes are generated when a worksheet is built. Rebuild this one
      // worksheet after setting the assigned student's identity so the scanner
      // payload is unique to that student, without printing personal details.
      if (studentIdentities) {
        const student = studentIdentities[i - 1];
        await page.evaluate(
          new Function('student', `
            const name = document.getElementById('studentName');
            const id = document.getElementById('studentId');
            if (name) name.value = student.name || '';
            if (id) id.value = student.studentId || student.rollNo || '';
            window.generateSets(1);
          `) as any,
          student
        );
      }
      const activeSetIndex = studentIdentities ? 1 : i;
      const rendered = await page.evaluate(
        new Function('obj', 'return (' + evaluateFnStr + ')(obj)') as any,
        {
          setIndex: activeSetIndex,
          classLevel,
          pdfFn: adapter.pdfFn,
          pdfFnArgs: adapter.pdfFnArgs(activeSetIndex),
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
