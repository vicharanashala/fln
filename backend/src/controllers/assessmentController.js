const path = require("path");
const fs = require("fs");
const Assessment = require("../models/Assessment");
const AssessmentTemplate = require("../models/AssessmentTemplate");
const pythonClient = require("../services/pythonClient");
const { safeFilename, UPLOAD_DIR, extractTextFromPdf } = require("../services/pdfParser");
const auditLog = require("../services/audit");

function owner(req) {
  return req.user?._id;
}

async function createAssessment(req, res) {
  try {
    const { title, subject, grade, language, academicYear, duration, totalMarks, assessmentType } = req.body || {};
    if (!title || !subject || !grade) {
      return res.status(400).json({ message: "title, subject, grade are required" });
    }
    const assessment = await Assessment.create({
      title: String(title).trim(),
      subject,
      grade,
      language: language || "English",
      academicYear: academicYear || "2025-26",
      duration: Number(duration) || 60,
      totalMarks: Number(totalMarks) || 0,
      assessmentType: assessmentType || "Diagnostic",
      createdBy: owner(req),
    });
    if (req.file) {
      const filename = safeFilename(req.file.originalname);
      const dest = path.join(UPLOAD_DIR, filename);
      fs.renameSync(req.file.path, dest);
      assessment.questionPaperUrl = `/uploads/${filename}`;
      assessment.questionPaperFileName = req.file.originalname;
      assessment.questionPaperSize = req.file.size;
      await assessment.save();
    }
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
      await AssessmentTemplate.findByIdAndDelete(assessment.templateId);
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

  let pdfPath = null;
  if (assessment.questionPaperUrl) {
    pdfPath = path.join(UPLOAD_DIR, path.basename(assessment.questionPaperUrl));
  }

  let modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const result = await pythonClient.generateTemplate({
      assessmentId: id,
      pdfPath,
      metadata: {
        title: assessment.title,
        subject: assessment.subject,
        grade: assessment.grade,
        language: assessment.language,
        academicYear: assessment.academicYear,
      },
    });
    modelName = result?.model || modelName;
    const processingTime = (Date.now() - t0) / 1000;
    assessment.templateStatus = "Generated";
    await assessment.save();
    await auditLog.logComplete(id, modelName, processingTime, result?.totalQuestions || 0);
    return res.json({
      ok: true,
      model: modelName,
      processingTime,
      preview: result,
    });
  } catch (err) {
    const processingTime = (Date.now() - t0) / 1000;
    assessment.templateStatus = "Pending";
    await assessment.save();
    await auditLog.logFailure(id, modelName, err.message, processingTime);
    return res.status(500).json({ message: err.message });
  }
}

module.exports = {
  createAssessment,
  listAssessments,
  getAssessment,
  deleteAssessment,
  generateTemplate,
};