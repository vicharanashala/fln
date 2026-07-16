const mongoose = require("mongoose");

// Generic atomic counter for sequential IDs.
// Usage:
//   await Counter.findOneAndUpdate(
//     { _id: "assessment_code" }, { $inc: { seq: 1 } },
//     { new: true, upsert: true }
//   );
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters" }
);

module.exports = mongoose.model("Counter", counterSchema);