require("dotenv").config();
const mongoose = require("mongoose");
const Assessment = require("../models/Assessment");
const AnswerKey = require("../models/AnswerKey");
const Counter = require("../models/Counter");

/**
 * Backfill missing assessmentCodes for old assessments.
 * Order: oldest first (createdAt ASC) so the sequence is preserved by time.
 * Also: copy the code into the AnswerKey document for fast lookup.
 */
async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Connected to:", process.env.MONGO_URI);

  // 1. Find all assessments without a code, oldest first
  const missing = await Assessment.find({ assessmentCode: { $exists: false } })
    .sort({ createdAt: 1 });
  const missingCount = await Assessment.countDocuments({ assessmentCode: { $exists: false } });
  console.log(`Found ${missingCount} assessments missing assessmentCode`);

  // 2. Determine the next sequence number
  let counter = await Counter.findById("assessment_code");
  if (!counter) {
    counter = await Counter.create({ _id: "assessment_code", seq: 0 });
  }
  let nextSeq = counter.seq;

  // 3. Assign codes in order
  for (const a of missing) {
    nextSeq += 1;
    const code = `AS${String(nextSeq).padStart(4, "0")}`;
    a.assessmentCode = code;
    await a.save();
    console.log(`  ✓ ${a._id}  →  ${code}  (${a.title})`);

    // Mirror code into the matching AnswerKey if one exists
    if (a.templateId) {
      await AnswerKey.updateMany(
        { assessmentId: a._id },
        { $set: { assessmentCode: code } }
      );
    }
  }

  // 4. Update the counter to reflect the new max
  counter.seq = nextSeq;
  await counter.save();
  console.log(`Counter updated to seq=${nextSeq} → next code will be AS${String(nextSeq + 1).padStart(4, "0")}`);

  // 5. Backfill assessmentCode on AnswerKey records that are missing it
  const akMissing = await AnswerKey.find({ assessmentCode: { $exists: false } });
  console.log(`\nAnswerKey docs without assessmentCode: ${akMissing.length}`);
  for (const ak of akMissing) {
    const parent = await Assessment.findById(ak.assessmentId).select("assessmentCode");
    if (parent?.assessmentCode) {
      ak.assessmentCode = parent.assessmentCode;
      await ak.save();
      console.log(`  ✓ AnswerKey ${ak._id} → ${ak.assessmentCode}`);
    }
  }

  // 6. Final verification
  console.log("\n=== VERIFICATION ===");
  const total = await Assessment.countDocuments();
  const withCode = await Assessment.countDocuments({ assessmentCode: { $exists: true, $ne: null } });
  console.log(`Assessments: ${withCode}/${total} have assessmentCode`);
  const akTotal = await AnswerKey.countDocuments();
  const akWithCode = await AnswerKey.countDocuments({ assessmentCode: { $exists: true, $ne: null } });
  console.log(`AnswerKeys:   ${akWithCode}/${akTotal} have assessmentCode`);

  const finalCounter = await Counter.findById("assessment_code");
  console.log(`Counter seq: ${finalCounter.seq} → next: AS${String(finalCounter.seq + 1).padStart(4, "0")}`);

  await mongoose.disconnect();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});