const mongoose = require("mongoose");

const CLASS_LEVELS = ["CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4"];
const FILE_TYPES = ["question_paper", "answer_key"];

const downloadLogSchema = new mongoose.Schema(
  {
    classLevel: {
      type: String,
      enum: CLASS_LEVELS,
      required: true,
    },
    fileType: {
      type: String,
      enum: FILE_TYPES,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    // Where the file landed, if known. Browsers control the actual save
    // path (usually the OS Downloads folder) for security reasons, so
    // this is best-effort / informational, not a guaranteed disk path.
    filePath: {
      type: String,
      default: "",
      trim: true,
    },
    outputFolderPath: {
      type: String,
      default: "",
      trim: true,
    },
    totalQuestions: {
      type: Number,
      default: null,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

downloadLogSchema.index({ classLevel: 1, downloadedAt: -1 });

module.exports = mongoose.model("DownloadLog", downloadLogSchema);
module.exports.CLASS_LEVELS = CLASS_LEVELS;
module.exports.FILE_TYPES = FILE_TYPES;
