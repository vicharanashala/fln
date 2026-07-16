require("dotenv").config();
const mongoose = require("mongoose");
const Assessment = require("../models/Assessment");
const User = require("../models/User");
const { ROLES } = require("../models/enums");

async function run() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fln_answerkey");
  console.log("MongoDB connected");

  const admin = await User.findOne({ email: "superadmin@fln.org" });
  if (!admin) {
    console.log("Superadmin not found — run seed:superadmin first");
    process.exit(1);
  }

  const demos = [
    {
      title: "Class 3 Mathematics FA1 2025-26",
      subject: "Numeracy",
      grade: "Class 3",
      language: "English",
      academicYear: "2025-26",
      duration: 60,
      totalMarks: 30,
      status: "Draft",
      templateStatus: "Pending",
      createdBy: admin._id,
    },
    {
      title: "Class 2 Literacy CB1 2025-26",
      subject: "Literacy",
      grade: "Class 2",
      language: "Hindi",
      academicYear: "2025-26",
      duration: 45,
      totalMarks: 20,
      status: "Draft",
      templateStatus: "Pending",
      createdBy: admin._id,
    },
    {
      title: "Class 4 Both SA1 2025-26",
      subject: "Both",
      grade: "Class 4",
      language: "English",
      academicYear: "2025-26",
      duration: 90,
      totalMarks: 50,
      status: "Scheduled",
      templateStatus: "Draft",
      createdBy: admin._id,
    },
    {
      title: "Class 4 Numeracy FA2 2025-26",
      subject: "Numeracy",
      grade: "Class 4",
      language: "Tamil",
      academicYear: "2025-26",
      duration: 60,
      totalMarks: 40,
      status: "Active",
      templateStatus: "Approved",
      createdBy: admin._id,
    },
  ];

  for (const d of demos) {
    const existing = await Assessment.findOne({ title: d.title });
    if (!existing) {
      await Assessment.create(d);
      console.log(`Created: ${d.title}`);
    } else {
      console.log(`Already exists: ${d.title}`);
    }
  }

  console.log("\nDemo assessments seeded.");
  const all = await Assessment.find().sort({ createdAt: -1 });
  all.forEach((a) =>
    console.log(` - [${a.templateStatus}] ${a.title} (${a.grade})`)
  );
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});