const mongoose = require("mongoose");

const CLASS_LEVELS = ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"];
const STATUSES = ["running", "completed", "cancelled", "failed"];

const generationJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    classLevel: {
      type: String,
      enum: CLASS_LEVELS,
      required: true,
      index: true,
    },
    totalSets: {
      type: Number,
      required: true,
      min: 1,
    },
    completed: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "running",
      index: true,
    },
    outputFolderPath: {
      type: String,
      required: true,
      trim: true,
    },
    errors: {
      type: [String],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

generationJobSchema.index(
  { classLevel: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "running" } }
);
generationJobSchema.index({ startedAt: -1 });

module.exports = mongoose.model("GenerationJob", generationJobSchema);
module.exports.CLASS_LEVELS = CLASS_LEVELS;
module.exports.STATUSES = STATUSES;
