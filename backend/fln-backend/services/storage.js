/**
 * services/storage.js
 *
 * Filesystem layout:
 *   storage/{batchId}/manifest.json
 *   storage/{batchId}/{studentFolderName}/{sublevelId}_set{n}/worksheet.pdf
 *   storage/{batchId}/{studentFolderName}/{sublevelId}_set{n}/answer_key.json
 *   storage/{batchId}/{studentFolderName}/{sublevelId}_set{n}/coords.json
 *
 * zipBatch() streams the whole batch directory as one ZIP using jszip's
 * generateNodeStream. PDFs are already compressed, so the archive stores
 * files directly rather than spending CPU re-compressing them.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const JSZip = require('jszip');

const STORAGE_ROOT = path.join(__dirname, '..', 'storage');

function sanitize(s) {
  return String(s == null ? '' : s)
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'unnamed';
}

function studentFolderName(rollNumber, studentName) {
  return `RollNo-${sanitize(rollNumber)}_${sanitize(studentName)}`;
}

function batchDir(batchId) {
  return path.join(STORAGE_ROOT, sanitize(batchId));
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/** Persists one rendered student/sublevel/set to disk. Returns the dir written. */
async function saveStudentSet(batchId, studentFolder, sublevelId, setNum, { pdfBuffer, answerKeyJson, coordsJson, questionPaperJson }) {
  const dir = path.join(batchDir(batchId), studentFolder, `${sublevelId}_set${setNum}`);
  await ensureDir(dir);
  await Promise.all([
    fsp.writeFile(path.join(dir, 'worksheet.pdf'), pdfBuffer),
    fsp.writeFile(path.join(dir, 'answer_key.json'), JSON.stringify(answerKeyJson, null, 2)),
    fsp.writeFile(path.join(dir, 'coords.json'), JSON.stringify(coordsJson, null, 2)),
    fsp.writeFile(path.join(dir, 'question_paper.json'), JSON.stringify(questionPaperJson, null, 2))
  ]);
  return dir;
}

async function saveManifest(batchId, manifest) {
  const dir = batchDir(batchId);
  await ensureDir(dir);
  await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function readManifest(batchId) {
  const file = path.join(batchDir(batchId), 'manifest.json');
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function batchExists(batchId) {
  try {
    const stat = await fsp.stat(batchDir(batchId));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively walks a batch's folder and adds every file into a JSZip
 * instance under the same relative path, then streams the compressed
 * result directly into the given writable (e.g. an Express response).
 */
async function zipBatch(batchId, writableStream) {
  const root = batchDir(batchId);
  const zip = new JSZip();

  async function addDir(dir, relBase) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relBase, entry.name);
      if (entry.isDirectory()) {
        await addDir(fullPath, relPath);
      } else {
        const data = await fsp.readFile(fullPath);
        const zipPath = relPath.split(path.sep).join('/');
        zip.file(zipPath, data);

        // If it is a worksheet.pdf, also add a flat copy to 'all_worksheets/'
        if (entry.name === 'worksheet.pdf') {
          const parts = relPath.split(path.sep);
          if (parts.length >= 3) {
            const studentFolder = parts[parts.length - 3];
            const subFolder = parts[parts.length - 2];
            const flatName = `all_worksheets/${studentFolder}_${subFolder}.pdf`;
            zip.file(flatName, data);
          }
        }
      }
    }
  }

  await addDir(root, '');

  return new Promise((resolve, reject) => {
    zip
      .generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' })
      .pipe(writableStream)
      .on('finish', resolve)
      .on('error', reject);
  });
}

module.exports = {
  STORAGE_ROOT,
  sanitize,
  studentFolderName,
  batchDir,
  saveStudentSet,
  saveManifest,
  readManifest,
  batchExists,
  zipBatch
};
