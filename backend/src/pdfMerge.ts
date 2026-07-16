import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Set } from './db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

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
  const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < renderedSets.length; i += 1) {
    const set = renderedSets[i];
    const student = students[i];

    const setBytes = Buffer.from(set.pdfBase64, "base64");
    const setPdf = await PDFDocument.load(setBytes);
    const copiedPages = await mergedPdf.copyPages(setPdf, setPdf.getPageIndices());

    const rollNo = student.rollNo || String(i + 1);
    const label = `Roll No: ${rollNo}   |   ${student.name}`;
    const fontSize = 9;
    const textWidth = font.widthOfTextAtSize(label, fontSize);

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
        font,
        color: rgb(0, 0, 0),
      });
    });
  }

  const bytes = await mergedPdf.save();
  return Buffer.from(bytes);
}

export async function buildSetPackage(set: Set, generatedPdfPaths: string[]): Promise<string> {
  const puppeteer = await import('puppeteer');
  const CHROME_EXECUTABLE_PATH = process.env.CHROME_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let coverPdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica', Arial, sans-serif; padding: 50px; text-align: center; }
          .title { font-size: 32px; font-weight: bold; margin-bottom: 20px; }
          .detail { font-size: 20px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="title">District-Level Set Package</div>
        <div class="detail"><strong>Set ID:</strong> ${set.id}</div>
        <div class="detail"><strong>Set Name:</strong> ${set.name}</div>
        <div class="detail"><strong>Assessment Name:</strong> ${set.assessmentName}</div>
        <div class="detail"><strong>School ID:</strong> ${set.schoolId}</div>
        <div class="detail"><strong>Class Group:</strong> ${set.classGroup}</div>
        <div class="detail"><strong>Total Students:</strong> ${set.studentIds.length}</div>
        <div class="detail"><strong>Generation Date:</strong> ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `;
    await page.setContent(html);
    coverPdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
  } finally {
    await browser.close();
  }

  const mergedPdf = await PDFDocument.create();
  
  // Add Cover Page
  const coverPdf = await PDFDocument.load(coverPdfBuffer);
  const coverPages = await mergedPdf.copyPages(coverPdf, coverPdf.getPageIndices());
  coverPages.forEach(p => mergedPdf.addPage(p));

  // Add all generated student PDFs
  for (const pdfPathUrl of generatedPdfPaths) {
    const filename = pdfPathUrl.split('/').pop();
    if (!filename) continue;
    const absolutePath = path.join(OUTPUT_DIR, filename);
    if (!fs.existsSync(absolutePath)) continue;

    const studentPdfBytes = fs.readFileSync(absolutePath);
    const studentPdf = await PDFDocument.load(studentPdfBytes);
    const studentPages = await mergedPdf.copyPages(studentPdf, studentPdf.getPageIndices());
    studentPages.forEach(p => mergedPdf.addPage(p));
  }

  const finalPdfBytes = await mergedPdf.save();
  const finalFilename = `set_${set.id}_package_${randomUUID()}.pdf`;
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const finalPath = path.join(OUTPUT_DIR, finalFilename);
  fs.writeFileSync(finalPath, finalPdfBytes);

  return `/output/${finalFilename}`;
}
