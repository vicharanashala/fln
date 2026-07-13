const multer = require("multer");
const path = require("path");
const os = require("os");
const { safeFilename } = require("../services/pdfParser");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
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