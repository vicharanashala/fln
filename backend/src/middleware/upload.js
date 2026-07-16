const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { safeFilename, UPLOAD_DIR } = require("../services/pdfParser");

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Write directly to UPLOAD_DIR so the same filename is used by both
// multer (when storing the file) and our controller (when building URLs).
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
});

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const fileFilter = (req, file, cb) => {
  const lower = file.originalname.toLowerCase();
  if (ACCEPTED_MIME.includes(file.mimetype) || lower.endsWith(".pdf") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and image files (jpg/png) are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = upload;