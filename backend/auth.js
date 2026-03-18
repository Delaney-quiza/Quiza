// backend/auth.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "7d";

// ═══════════════════════════════════════
// ADMIN AUTH
// ═══════════════════════════════════════

function generateAdminToken(email) {
  return jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

async function validateAdminLogin(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sportq.app";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (email !== adminEmail) return null;

  // In production, use bcrypt hash stored in DB
  // For now, direct comparison with env var
  if (password !== adminPassword) return null;

  return generateAdminToken(email);
}

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ═══════════════════════════════════════
// PLAYER AUTH (Anonymous)
// ═══════════════════════════════════════

function generatePlayerToken() {
  const { v4: uuidv4 } = require("uuid");
  return uuidv4();
}

function playerAuthMiddleware(req, res, next) {
  const token = req.headers["x-player-token"];
  if (!token) {
    return res.status(401).json({ error: "Player token required" });
  }

  const db = require("./database");
  const player = db.players.getByToken(token);
  if (!player) {
    return res.status(401).json({ error: "Invalid player token" });
  }

  req.player = player;
  next();
}

module.exports = {
  generateAdminToken,
  validateAdminLogin,
  adminAuthMiddleware,
  generatePlayerToken,
  playerAuthMiddleware,
};
