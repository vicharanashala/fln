const Assessment = require("../models/Assessment");
const AssessmentTemplate = require("../models/AssessmentTemplate");
const pythonClient = require("../services/pythonClient");

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
    const template = await AssessmentTemplate.findOne({ assessmentId })
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
    const existing = await AssessmentTemplate.findOne({ assessmentId }).sort({ version: -1 });
    let template;
    if (existing && existing.status !== "Approved") {
      existing.questions = questions;
      if (status === "Draft") existing.status = "Draft";
      template = await existing.save();
    } else {
      template = await AssessmentTemplate.create({
        assessmentId,
        questions,
        status: "Draft",
        generatedBy: req.body.generatedBy || "ai",
        modelName: req.body.modelName || "unknown",
        version: existing ? existing.version + 1 : 1,
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

async function approveTemplate(req, res) {
  try {
    const { assessmentId } = req.params;
    const template = await AssessmentTemplate.findOne({ assessmentId }).sort({ version: -1 });
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
    const template = await AssessmentTemplate.findOneAndDelete({ assessmentId }).sort({ version: -1 });
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
};