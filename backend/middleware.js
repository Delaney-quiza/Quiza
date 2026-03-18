// backend/middleware.js
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// CORS config
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Player-Token"],
};

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later" },
});

const quizSubmitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 submissions per minute (anti-brute-force)
  message: { error: "Too many submissions, please slow down" },
});

const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 AI generation requests per hour
  message: { error: "Generation rate limit reached" },
});

// Error handler
function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err.message);
  console.error(err.stack);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
}

// Request logger
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
}

module.exports = {
  corsMiddleware: cors(corsOptions),
  generalLimiter,
  quizSubmitLimiter,
  aiGenerateLimiter,
  errorHandler,
  requestLogger,
};
