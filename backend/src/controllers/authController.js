const User = require("../models/User");
const { ROLES } = require("../models/enums");

async function login(req, res) {
  try {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ message: "email, password, role are required" });
    }
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.role !== role) {
      return res.status(403).json({ message: `This account is not a ${role}` });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt_sign(user);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

function jwt_sign(user) {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

module.exports = { login, me };