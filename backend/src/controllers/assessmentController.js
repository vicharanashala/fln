const path = require("path");
const fs = require("fs");
const Assessment = require("../models/Assessment");
const AnswerKey = require("../models/AnswerKey");
const pythonClient = require("../services/pythonClient");
const { UPLOAD_DIR } = require("../services/pdfParser");
const Counter = require("../models/Counter");
const auditLog = require("../services/audit");

function owner(req) {
  return req.user?._id;
}

/**
 * Generate the next human-readable assessmentCode (e.g., "AS0010").
 * Uses a counter collection with atomic $inc to avoid race conditions.
 */
async function nextAssessmentCode() {
  const Counter = require("../models/Counter");
  const doc = await Counter.findOneAndUpdate(
    { _id: "assessment_code" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = doc.seq || 1;
  // Pad to 4 digits: 1 → "AS0001", 10 → "AS0010", 1234 → "AS1234"
  return `AS${String(seq).padStart(4, "0")}`;
}

async function createAssessment(req, res) {
  try {
    const { title, subject, grade, language, academicYear, duration, totalMarks, assessmentType, setNumber } = req.body || {};
    if (!title || !subject || !grade) {
      return res.status(400).json({ message: "title, subject, grade are required" });
    }
    const code = await nextAssessmentCode();
    const files = Array.isArray(req.files) && req.files.length > 0
      ? req.files
      : req.file ? [req.file] : [];

    const assessment = await Assessment.create({
      title: String(title).trim(),
      subject,
      grade,
      setNumber: setNumber || "Set 1",
      assessmentCode: code,
      language: language || "English",
      academicYear: academicYear || "2025-26",
      duration: Number(duration) || 60,
      totalMarks: Number(totalMarks) || 0,
      assessmentType: assessmentType || "Diagnostic",
      createdBy: owner(req),
    });

    if (files.length === 1) {
      // Backwards-compatible single-file fields
      const f = files[0];
      const urlPath = `/uploads/${f.filename}`;
      assessment.questionPaperUrl = urlPath;
      assessment.questionPaperFileName = f.originalname;
      assessment.questionPaperSize = f.size;
    }
    if (files.length > 0) {
      const urls = files.map((f) => `/uploads/${f.filename}`);
      const names = files.map((f) => f.originalname);
      const sizes = files.map((f) => f.size);
      assessment.questionPaperUrls = urls;
      assessment.questionPaperFileNames = names;
      assessment.questionPaperSizes = sizes;
    }
    await assessment.save();
    return res.status(201).json({ assessment });
  } catch (err) {
    console.error("createAssessment:", err);
    return res.status(500).json({ message: err.message });
  }
}

async function listAssessments(req, res) {
  try {
    const { academicYear, subject, grade, templateStatus, q } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (subject) filter.subject = subject;
    if (grade) filter.grade = grade;
    if (templateStatus) filter.templateStatus = templateStatus;
    if (q) filter.title = { $regex: q, $options: "i" };

    const assessments = await Assessment.find(filter)
      .populate("templateId", "status totalQuestions totalMarks version")
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json({ assessments });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function getAssessment(req, res) {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id).populate(
      "templateId",
      "status totalQuestions totalMarks version verifiedAt"
    );
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    return res.json({ assessment });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function deleteAssessment(req, res) {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    if (assessment.questionPaperUrl) {
      const fp = path.join(UPLOAD_DIR, path.basename(assessment.questionPaperUrl));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    if (assessment.templateId) {
      await AnswerKey.findByIdAndDelete(assessment.templateId);
    }
    await Assessment.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function generateTemplate(req, res) {
  const { id } = req.params;
  const t0 = Date.now();

  const assessment = await Assessment.findById(id);
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  assessment.templateStatus = "Processing";
  await assessment.save();
  await auditLog.logStart(id, "pending");

  // Build list of paths: prefer multi-file array; fall back to single file
  const fileUrls = assessment.questionPaperUrls?.length
    ? assessment.questionPaperUrls
    : (assessment.questionPaperUrl ? [assessment.questionPaperUrl] : []);
  const filePaths = fileUrls
    .map((u) => path.join(UPLOAD_DIR, path.basename(u)))
    .filter((p) => fs.existsSync(p));

  if (filePaths.length === 0) {
    return res.status(400).json({ message: "No question paper file uploaded" });
  }

  let modelName = "groq";
  try {
    const result = await pythonClient.generateTemplate({
      assessmentId: id,
      filePaths,           // array (multi-image mode)
      pdfPath: filePaths.length === 1 ? filePaths[0] : undefined,  // backwards compat
      metadata: {
        title: assessment.title,
        subject: assessment.subject,
        grade: assessment.grade,
        language: assessment.language,
        academicYear: assessment.academicYear,
        totalFiles: filePaths.length,
        isImageMode: filePaths.length > 1 || !filePaths[0].toLowerCase().endsWith(".pdf"),
      },
    });
    modelName = result?.provider ? `${result.provider}/${result.model}` : modelName;
    const processingTime = (Date.now() - t0) / 1000;
    assessment.templateStatus = "Generated";
    await assessment.save();
    await auditLog.logComplete(id, modelName, processingTime, result?.totalQuestions || 0);

    // Auto-save as Draft so regenerate-question has a template to work with
    try {
      const existing = await AnswerKey.findOne({ assessmentId: id }).sort({ version: -1 });
      let template;
      if (existing) {
        existing.questions = result.questions || [];
        existing.modelName = result.model || "unknown";
        existing.status = "Draft";
        if (assessment.assessmentCode && !existing.assessmentCode) {
          existing.assessmentCode = assessment.assessmentCode;
        }
        template = await existing.save();
      } else {
        template = await AnswerKey.create({
          assessmentId: id,
          questions: result.questions || [],
          status: "Draft",
          generatedBy: "ai",
          modelName: result.model || "unknown",
          assessmentCode: assessment.assessmentCode,
          version: 1,
        });
      }
      assessment.templateId = template._id;
      assessment.templateStatus = "Draft";
      await assessment.save();
    } catch (saveErr) {
      console.error("Auto-save template failed (non-fatal):", saveErr.message);
    }

    return res.json({
      ok: true,
      model: modelName,
      provider: result?.provider,
      processingTime,
      preview: result,
    });
  } catch (err) {
    const processingTime = (Date.now() - t0) / 1000;
    assessment.templateStatus = "Pending";
    await assessment.save();
    const errorMessage = err.response?.data?.detail || err.message;
    await auditLog.logFailure(id, modelName, errorMessage, processingTime);
    return res.status(500).json({ message: errorMessage });
  }
}

module.exports = {
  createAssessment,
  listAssessments,
  getAssessment,
  deleteAssessment,
  generateTemplate,
};