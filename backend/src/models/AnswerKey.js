const mongoose = require("mongoose");
const { QUESTION_TYPES, DIFFICULTY } = require("./Assessment");

const ANSWER_KEY_STATUS = ["Draft", "Approved", "Archived"];

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
    sourceFileIndex: { type: Number, default: null },
    visualDescription: { type: String, default: "" },
    hasImage: { type: Boolean, default: false },
  },
  { _id: false }
);

// Explicit collection name = "answerkeys"
const answerKeySchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    assessmentCode: { type: String, trim: true, index: true },
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ANSWER_KEY_STATUS,
      default: "Draft",
      index: true,
    },
    generatedBy: { type: String, default: "ai", enum: ["ai", "manual"] },
    modelName: { type: String, default: "mock" },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    totalQuestions: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true, collection: "answerkeys" }
);

answerKeySchema.pre("save", function (next) {
  this.totalQuestions = this.questions.length;
  this.totalMarks = this.questions.reduce((a, b) => a + (b.marks || 0), 0);
  next();
});

answerKeySchema.set("toJSON", { virtuals: true, versionKey: false });
answerKeySchema.set("toObject", { virtuals: true, versionKey: false });

module.exports = mongoose.model("AnswerKey", answerKeySchema);
module.exports.ANSWER_KEY_STATUS = ANSWER_KEY_STATUS;