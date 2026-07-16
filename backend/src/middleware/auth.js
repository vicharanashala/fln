const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ALL_ROLES } = require("../models/enums");

async function requireAuth(req, res, next) {
  try {
    let user = await User.findOne({ role: "superadmin" });
    if (!user) {
      user = await User.create({
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@fln.org",
        password: "Welcome1!",
        role: "superadmin",
        isActive: true,
      });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth bypass error:", err);
    return res.status(500).json({ message: "Auth bypass failed: " + err.message });
  }
}

function requireRole(...allowed) {
  const set = new Set(allowed);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (!set.has(req.user.role)) {
      return res.status(403).json({ message: "Forbidden for role " + req.user.role });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ALL_ROLES };