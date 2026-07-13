const axios = require("axios");

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:5051";
const TIMEOUT_MS = 120000;

async function generateTemplate({ assessmentId, pdfPath, filePaths, metadata = {} }) {
  const res = await axios.post(
    `${PYTHON_URL}/generate-template`,
    { assessmentId, pdfPath, filePaths, metadata },
    { timeout: TIMEOUT_MS }
  );
  return res.data;
}

async function health() {
  try {
    const res = await axios.get(`${PYTHON_URL}/health`, { timeout: 5000 });
    return res.data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { generateTemplate, health, PYTHON_URL };