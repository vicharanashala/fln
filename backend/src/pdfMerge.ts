import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname_esm, "../assets/fonts");
const hasDevanagari = (text: string) => /[ऀ-ॿ]/.test(text);

export interface StudentInfo {
  rollNo?: string;
  name: string;
  studentId?: string;
  qrData?: Record<string, unknown>;
}

export interface RenderedSet {
  index: number;
  pdfBase64: string;
}

export async function mergeAndStamp(renderedSets: RenderedSet[], students: StudentInfo[]): Promise<Buffer> {
  if (renderedSets.length !== students.length) {
    throw new Error(
      `renderedSets (${renderedSets.length}) and students (${students.length}) must be the same length.`
    );
  }

  const mergedPdf = await PDFDocument.create();
  mergedPdf.registerFontkit(fontkit);
  const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
  const devaBold = await mergedPdf.embedFont(
    fs.readFileSync(path.join(FONT_DIR, "NotoSansDevanagari-Bold.ttf")),
    { subset: true }
  );
  const fontFor = (text: string) => (hasDevanagari(text) ? devaBold : font);

  for (let i = 0; i < renderedSets.length; i += 1) {
    const set = renderedSets[i];
    const student = students[i];

    const setBytes = Buffer.from(set.pdfBase64, "base64");
    const setPdf = await PDFDocument.load(setBytes);
    const copiedPages = await mergedPdf.copyPages(setPdf, setPdf.getPageIndices());

    const rollNo = student.rollNo || String(i + 1);
    const label = `STUDENT: ${student.name.toUpperCase()}   (ID: ${student.studentId || student.rollNo || rollNo})`;
    const labelFont = fontFor(label);
    const fontSize = 9;
    const textWidth = labelFont.widthOfTextAtSize(label, fontSize);

    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
      const { width, height } = page.getSize();

      // Small unobtrusive stamp in the top-right margin
      const boxPadding = 4;
      const boxWidth = textWidth + boxPadding * 2;
      const boxHeight = fontSize + boxPadding * 2;
      const x = width - boxWidth - 10;
      const y = height - boxHeight - 6;

      page.drawRectangle({
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.75,
      });
      page.drawText(label, {
        x: x + boxPadding,
        y: y + boxPadding,
        size: fontSize,
        font: labelFont,
        color: rgb(0, 0, 0),
      });
    });
  }

  const bytes = await mergedPdf.save();
  return Buffer.from(bytes);
}
