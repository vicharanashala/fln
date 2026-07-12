const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ALL_ROLES } = require("../models/enums");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid user" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
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