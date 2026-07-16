const Assessment = require("../models/Assessment");
const AnswerKey = require("../models/AnswerKey");
const pythonClient = require("../services/pythonClient");
const { UPLOAD_DIR } = require("../services/pdfParser");

async function generateOnly(req, res) {
  const { id } = req.params;
  const t0 = Date.now();
  const assessment = await Assessment.findById(id);
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const pdfPath = assessment.questionPaperUrl
    ? require("path").join(
        require("path").resolve(__dirname, "..", "..", "uploads"),
        require("path").basename(assessment.questionPaperUrl)
      )
    : null;

  try {
    const result = await pythonClient.generateTemplate({
      assessmentId: id,
      pdfPath,
      metadata: {
        title: assessment.title,
        subject: assessment.subject,
        grade: assessment.grade,
        language: assessment.language,
      },
    });
    return res.json({
      ok: true,
      model: result.model || process.env.GEMINI_MODEL || "gemini-2.0-flash",
      processingTime: (Date.now() - t0) / 1000,
      preview: result,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function getTemplate(req, res) {
  try {
    const { assessmentId } = req.params;
    const template = await AnswerKey.findOne({ assessmentId })
      .sort({ version: -1 })
      .populate("verifiedBy", "firstName lastName email");
    if (!template) return res.status(404).json({ message: "Template not generated yet" });
    return res.json({ template });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function saveTemplate(req, res) {
  try {
    const { assessmentId } = req.params;
    const { questions, status } = req.body || {};
    if (!Array.isArray(questions)) {
      return res.status(400).json({ message: "questions[] required" });
    }
    // Lookup parent assessment to copy assessmentCode into the answerkey
    const parent = await Assessment.findById(assessmentId).select("assessmentCode");
    const code = parent?.assessmentCode || null;
    const existing = await AnswerKey.findOne({ assessmentId }).sort({ version: -1 });
    let template;
    if (existing) {
      existing.questions = questions;
      if (status) existing.status = status;
      if (code && !existing.assessmentCode) existing.assessmentCode = code;
      template = await existing.save();
    } else {
      template = await AnswerKey.create({
        assessmentId,
        questions,
        status: status || "Draft",
        generatedBy: req.body.generatedBy || "ai",
        modelName: req.body.modelName || "unknown",
        assessmentCode: code,
        version: 1,
      });
    }
    const assessment = await Assessment.findById(assessmentId);
    if (assessment) {
      assessment.templateId = template._id;
      assessment.templateStatus = "Draft";
      await assessment.save();
    }
    return res.json({ template });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function regenerateOne(req, res) {
  try {
    const { assessmentId, questionIndex } = req.params;
    const idx = parseInt(questionIndex, 10);
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ message: "questionIndex required" });
    }
    const { imageBase64, promptHint } = req.body || {};
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    // Find the question in the current template
    const template = await AnswerKey.findOne({ assessmentId }).sort({ version: -1 });
    if (!template) return res.status(404).json({ message: "No template found" });

    const question = template.questions[questionIndex];
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Call Python to re-extract this question
    const filePaths = assessment.questionPaperUrls?.length
      ? assessment.questionPaperUrls.map((u) => require("path").join(UPLOAD_DIR, require("path").basename(u)))
      : (assessment.questionPaperUrl ? [require("path").join(UPLOAD_DIR, require("path").basename(assessment.questionPaperUrl))] : []);

    if (filePaths.length === 0) return res.status(400).json({ message: "No source file" });

    // For multi-image uploads, each file IS one question → use the specific image
    // For single PDF, pass the file + questionIndex → Python re-extracts and picks
    const targetFilePath = filePaths.length > idx ? filePaths[idx] : filePaths[0];

    const result = await pythonClient.regenerateQuestion({
      assessmentId,
      questionIndex: idx,
      filePath: targetFilePath,
      imageBase64,
      promptHint,
    });
    return res.json({ ok: true, question: result });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function approveTemplate(req, res) {
  try {
    const { assessmentId } = req.params;
    const template = await AnswerKey.findOne({ assessmentId }).sort({ version: -1 });
    if (!template) return res.status(404).json({ message: "No template to approve" });
    if (template.status === "Approved") return res.json({ template });
    template.status = "Approved";
    template.verifiedBy = req.user?._id || null;
    template.verifiedAt = new Date();
    await template.save();
    const assessment = await Assessment.findById(assessmentId);
    if (assessment) {
      assessment.templateId = template._id;
      assessment.templateStatus = "Approved";
      await assessment.save();
    }
    return res.json({ template });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function deleteTemplate(req, res) {
  try {
    const { assessmentId } = req.params;
    const template = await AnswerKey.findOneAndDelete({ assessmentId }).sort({ version: -1 });
    if (!template) return res.status(404).json({ message: "No template to delete" });
    const assessment = await Assessment.findById(assessmentId);
    if (assessment) {
      assessment.templateId = null;
      assessment.templateStatus = "Pending";
      await assessment.save();
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

module.exports = {
  generateOnly,
  getTemplate,
  saveTemplate,
  approveTemplate,
  deleteTemplate,
  regenerateOne,
};