import path from 'path';

const MODULE_DIR = path.dirname(path.resolve(process.argv[1] || path.join(process.cwd(), 'src', 'index.ts')));

// Worksheet HTML templates (class1..4.html) live in the frontend package; the
// backend reads them for Puppeteer PDF rendering. Overridable via env so the
// backend can be deployed independently of the frontend source tree.
const WORKSHEETS_DIR =
  process.env.WORKSHEET_ASSETS_DIR ||
  path.resolve(MODULE_DIR, "..", "..", "frontend", "public", "worksheets");

export interface Adapter {
  file: string;
  label: string;
  pdfFn: string;
  pdfFnArgs: (setIndex: number) => any[];
  pdfFnReturnsCoords: boolean;
}

export const ADAPTERS: Record<string, Adapter> = {
  CLASS_1: {
    file: path.join(WORKSHEETS_DIR, "class1.html"),
    label: "Class 1",
    pdfFn: "renderSetToPdf",
    pdfFnArgs: (setIndex) => [setIndex, 2],
    pdfFnReturnsCoords: true,
  },
  CLASS_2: {
    file: path.join(WORKSHEETS_DIR, "class2.html"),
    label: "Class 2",
    pdfFn: "buildPdfBlobForSet",
    pdfFnArgs: (setIndex) => [setIndex],
    pdfFnReturnsCoords: true,
  },
  CLASS_3: {
    file: path.join(WORKSHEETS_DIR, "class3.html"),
    label: "Class 3",
    pdfFn: "buildPdfBlob",
    pdfFnArgs: (setIndex) => [setIndex],
    pdfFnReturnsCoords: false,
  },
  CLASS_4: {
    file: path.join(WORKSHEETS_DIR, "class4.html"),
    label: "Class 4",
    pdfFn: "buildPdfBlobForSet",
    pdfFnArgs: (setIndex) => [setIndex],
    pdfFnReturnsCoords: false,
  },
  LEVEL_PERSONALIZED: {
    file: path.join(WORKSHEETS_DIR, "levels_main.html"),
    label: "Level Personalized",
    pdfFn: "buildPdfBlob",
    pdfFnArgs: (setIndex) => [setIndex - 1],
    pdfFnReturnsCoords: false,
  },
};

export const MAX_SETS_PER_PAGE_LOAD = 5000;

export function getAdapter(classLevel: string): Adapter {
  const adapter = ADAPTERS[classLevel];
  if (!adapter) {
    throw new Error(
      `No worksheet adapter registered for classLevel "${classLevel}". Valid values: ${Object.keys(
        ADAPTERS
      ).join(", ")}`
    );
  }
  return adapter;
}

export const CLASS_LEVELS = Object.keys(ADAPTERS);
