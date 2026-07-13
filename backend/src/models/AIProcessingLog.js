const mongoose = require("mongoose");

const AI_LOG_STATUS = ["Started", "Completed", "Failed"];

const aiProcessingLogSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    status: { type: String, enum: AI_LOG_STATUS, required: true },
    model: { type: String, default: "mock" },
    processingTime: { type: Number, default: 0 },
    error: { type: String, default: null },
    questionsExtracted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiProcessingLogSchema.set("toJSON", { virtuals: true, versionKey: false });
aiProcessingLogSchema.set("toObject", { virtuals: true, versionKey: false });

module.exports = mongoose.model("AIProcessingLog", aiProcessingLogSchema);
module.exports.AI_LOG_STATUS = AI_LOG_STATUS;