const mongoose = require("mongoose");
const { QUESTION_TYPES, DIFFICULTY } = require("./Assessment");

const TEMPLATE_STATUS = ["Draft", "Approved", "Archived"];

const imageSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    position: { type: String, default: "inline" },
  },
  { _id: false }
);

const boundingBoxSchema = new mongoose.Schema(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionNo: { type: Number, required: true },
    pageNumber: { type: Number, default: 1 },
    questionText: { type: String, required: true, trim: true },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    concept: { type: String, default: "", trim: true },
    difficulty: { type: String, enum: DIFFICULTY, default: "Easy" },
    marks: { type: Number, default: 1, min: 0 },
    answerType: { type: String, default: "text" },
    correctAnswer: { type: String, default: "", trim: true },
    alternateAnswers: { type: [String], default: [] },
    evaluationRule: { type: String, default: "exact" },
    boundingBox: { type: boundingBoxSchema, default: () => ({}) },
    images: { type: [imageSchema], default: [] },
  },
  { _id: false }
);

const assessmentTemplateSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    version: { type: Number, default: 1 },
    status: { type: String, enum: TEMPLATE_STATUS, default: "Draft", index: true },
    generatedBy: { type: String, default: "ai", enum: ["ai", "manual"] },
    modelName: { type: String, default: "mock" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    totalQuestions: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

assessmentTemplateSchema.pre("save", function (next) {
  this.totalQuestions = this.questions.length;
  this.totalMarks = this.questions.reduce((a, b) => a + (b.marks || 0), 0);
  next();
});

assessmentTemplateSchema.set("toJSON", { virtuals: true, versionKey: false });
assessmentTemplateSchema.set("toObject", { virtuals: true, versionKey: false });

module.exports = mongoose.model("AssessmentTemplate", assessmentTemplateSchema);
module.exports.TEMPLATE_STATUS = TEMPLATE_STATUS;