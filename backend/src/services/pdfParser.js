const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeFilename(originalName) {
  const ts = Date.now();
  const safe = String(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  return `${ts}-${safe}`;
}

function fileToBuffer(filePath) {
  return fs.readFileSync(filePath);
}

async function extractTextFromPdf(filePath) {
  try {
    const pdfParse = require("pdf-parse");
    const buffer = fileToBuffer(filePath);
    const data = await pdfParse(buffer);
    return {
      text: data.text || "",
      numpages: data.numpages || 0,
      info: data.info || {},
    };
  } catch (err) {
    return { text: "", numpages: 0, info: {}, error: err.message };
  }
}

module.exports = { UPLOAD_DIR, safeFilename, fileToBuffer, extractTextFromPdf };