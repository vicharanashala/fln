const mongoose = require("mongoose");

const ASSESSMENT_TEMPLATE_STATUS = ["Pending", "Processing", "Generated", "Draft", "Approved"];
const ASSESSMENT_STATUS = ["Draft", "Scheduled", "Active", "Completed", "Archived"];
const ASSESSMENT_TYPES = ["Diagnostic", "Formative", "Summative", "Practice"];
const SUBJECTS = ["Literacy", "Numeracy", "Both"];
const QUESTION_TYPES = [
  "MCQ",
  "True/False",
  "Fill in the Blanks",
  "Short Answer",
  "Long Answer",
  "Match the Following",
  "Counting",
  "Addition",
  "Subtraction",
  "Number Recognition",
  "Drawing",
  "Trace",
];
const DIFFICULTY = ["Easy", "Medium", "Hard"];
const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi", "Urdu"];
const GRADES = ["Class 1", "Class 2", "Class 3", "Class 4"];

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, enum: SUBJECTS, required: true },
    grade: { type: String, enum: GRADES, required: true, trim: true },
    setNumber: { type: String, default: "Set 1", trim: true },
    assessmentCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
      // Format: "AS0010", "AS0011", ...
    },
    language: { type: String, default: "English", trim: true },
    academicYear: { type: String, default: "2025-26", trim: true },
    totalMarks: { type: Number, default: 0 },
    duration: { type: Number, default: 60 },
    questionPaperUrl: { type: String, default: null },
    questionPaperFileName: { type: String, default: null },
    questionPaperSize: { type: Number, default: null },
    questionPaperUrls: { type: [String], default: [] },
    questionPaperFileNames: { type: [String], default: [] },
    questionPaperSizes: { type: [Number], default: [] },
    assessmentType: { type: String, enum: ASSESSMENT_TYPES, default: "Diagnostic" },
    status: { type: String, enum: ASSESSMENT_STATUS, default: "Draft" },
    templateStatus: {
      type: String,
      enum: ASSESSMENT_TEMPLATE_STATUS,
      default: "Pending",
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnswerKey",
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

assessmentSchema.set("toJSON", { virtuals: true, versionKey: false });
assessmentSchema.set("toObject", { virtuals: true, versionKey: false });

module.exports = mongoose.model("Assessment", assessmentSchema);
module.exports.ASSESSMENT_TEMPLATE_STATUS = ASSESSMENT_TEMPLATE_STATUS;
module.exports.ASSESSMENT_STATUS = ASSESSMENT_STATUS;
module.exports.ASSESSMENT_TYPES = ASSESSMENT_TYPES;
module.exports.SUBJECTS = SUBJECTS;
module.exports.QUESTION_TYPES = QUESTION_TYPES;
module.exports.DIFFICULTY = DIFFICULTY;
module.exports.LANGUAGES = LANGUAGES;
module.exports.GRADES = GRADES;