require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { ROLES } = require("../models/enums");

async function run() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fln_answerkey");
  console.log("MongoDB connected");

  const email = "superadmin@fln.org";
  const password = "Welcome1!";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Superadmin already exists: ${email}`);
    process.exit(0);
  }

  const u = await User.create({
    firstName: "Super",
    lastName: "Admin",
    email,
    password,
    role: ROLES.SUPERADMIN,
    isActive: true,
  });
  console.log(`Superadmin created: ${u.email} / ${password}  (role=${u.role})`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});