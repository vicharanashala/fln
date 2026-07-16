const AIProcessingLog = require("../models/AIProcessingLog");

async function logStart(assessmentId, model = "unknown") {
  return AIProcessingLog.create({
    assessmentId,
    model,
    status: "Started",
    processingTime: 0,
  });
}

async function logComplete(assessmentId, model, processingTime, questionsExtracted = 0) {
  return AIProcessingLog.create({
    assessmentId,
    model,
    status: "Completed",
    processingTime,
    questionsExtracted,
  });
}

async function logFailure(assessmentId, model, error, processingTime = 0) {
  return AIProcessingLog.create({
    assessmentId,
    model,
    status: "Failed",
    error: String(error).slice(0, 1000),
    processingTime,
  });
}

async function logsFor(assessmentId) {
  return AIProcessingLog.find({ assessmentId }).sort({ createdAt: -1 }).limit(20);
}

module.exports = { logStart, logComplete, logFailure, logsFor };