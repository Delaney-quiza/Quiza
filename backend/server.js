// backend/server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./database");
const auth = require("./auth");
const middleware = require("./middleware");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════

app.use(middleware.corsMiddleware);
app.use(express.json());
app.use(middleware.requestLogger);
app.use("/api", middleware.generalLimiter);

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getToday() {
  return new Date().toISOString().split("T")[0];
}

const QUESTION_TIME_LIMIT = 15; // seconds per question
const QUESTIONS_PER_QUIZ = 5;   // ← updated from 3 to 5
const MAX_SCORE = QUESTIONS_PER_QUIZ * 100; // 500

// Score a single answer: <1s = 100pts, otherwise time-based
function scoreAnswer(timeElapsed) {
  if (timeElapsed === null) return 0;
  if (timeElapsed < 1) return 100;
  return Math.max(0, Math.round(((QUESTION_TIME_LIMIT - timeElapsed) / QUESTION_TIME_LIMIT) * 100));
}

// ═══════════════════════════════════════
// PUBLIC ROUTES — QUIZ
// ═══════════════════════════════════════

// Get today's quiz (no answers included)
app.get("/api/quiz/today", (req, res) => {
  const today = getToday();
  const schedule = db.schedule.getByDate(today);

  if (!schedule) {
    return res.status(404).json({ error: "No quiz scheduled for today" });
  }

  const correct_answers = schedule.questions.map(q => q.correct_answer);
  const questions = schedule.questions.map((q, i) => ({
    id: q.id,
    index: i,
    question: q.question,
    options: q.options,
    category: q.category,
    difficulty: q.difficulty,
  }));

  res.json({
    date: today,
    questions,
    correct_answers,
    time_limit: QUESTION_TIME_LIMIT,
    server_time: Date.now(),
  });
});

// Submit quiz answers
app.post("/api/quiz/submit", middleware.quizSubmitLimiter, auth.playerAuthMiddleware, (req, res) => {
  const today = getToday();
  const { answers, timings, start_time } = req.body;

  // Validate input — allow 5 questions
  if (!answers || !timings || answers.length !== QUESTIONS_PER_QUIZ || timings.length !== QUESTIONS_PER_QUIZ) {
    return res.status(400).json({ error: "Invalid submission format" });
  }

  // Check if already played today
  // TEMP: daily limit disabled
  // if (db.players.hasPlayedToday(req.player.id, today)) {
    // return res.status(409).json({ error: "Already played today" });
  }

  // Get today's schedule with answers
  const schedule = db.schedule.getByDate(today);
  if (!schedule) {
    return res.status(404).json({ error: "No quiz scheduled for today" });
  }

  // Validate timings (anti-cheat)
  for (let i = 0; i < QUESTIONS_PER_QUIZ; i++) {
    if (timings[i] !== null) {
      if (timings[i] < 0.1) {
        return res.status(400).json({ error: "Invalid timing detected" });
      }
      if (timings[i] > QUESTION_TIME_LIMIT + 1) {
        timings[i] = null; // Treat as expired
      }
    }
  }

  // Server-side timestamp validation
  if (start_time) {
    const totalElapsed = (Date.now() - start_time) / 1000;
    const maxPossible = QUESTION_TIME_LIMIT * QUESTIONS_PER_QUIZ + 60; // buffer for reveals/transitions
    if (totalElapsed > maxPossible) {
      console.warn(`⚠️ Suspicious timing from player ${req.player.id}: ${totalElapsed}s total`);
    }
  }

  // Score answers server-side
  const correct = [];
  let score = 0;
  let totalTime = 0;

  for (let i = 0; i < QUESTIONS_PER_QUIZ; i++) {
    const isCorrect = answers[i] === schedule.questions[i].correct_answer;
    correct.push(isCorrect);

    if (timings[i] === null) {
      totalTime += QUESTION_TIME_LIMIT;
    } else {
      totalTime += timings[i];
      if (isCorrect) {
        score += scoreAnswer(timings[i]);
      }
    }
  }

  const correctCount = correct.filter(Boolean).length;
  const isPerfect = correctCount === QUESTIONS_PER_QUIZ;

  // Save result (5 questions)
  db.players.saveResult(req.player.id, today, {
    answers, timings, correct, score, totalTime,
  });

  // Update player stats — total_games increments here (single source of truth)
  const updatedPlayer = db.players.updateStats(req.player.id, score, isPerfect, today);

  // Check for new badges
  const badges = calculateBadges(updatedPlayer, timings, correct);

  res.json({
    date: today,
    correct,
    correct_answers: schedule.questions.map((q) => q.correct_answer),
    score,
    total_time: totalTime,
    correct_count: correctCount,
    is_perfect: isPerfect,
    player_stats: {
      streak: updatedPlayer.streak,
      longest_streak: updatedPlayer.longest_streak,
      total_games: updatedPlayer.total_games,
      perfect_games: updatedPlayer.perfect_games,
      total_score: updatedPlayer.total_score,
      avg_score: Math.round(updatedPlayer.total_score / updatedPlayer.total_games),
    },
    new_badges: badges.new,
    all_badges: badges.all,
  });
});

// ═══════════════════════════════════════
// BADGE SYSTEM
// ═══════════════════════════════════════

const BADGE_DEFINITIONS = [
  { id: "first_perfect", name: "Sharp Shooter", icon: "🎯", desc: "Get all 5 correct" },
  { id: "streak_3", name: "Hat Trick", icon: "🔥", desc: "3-day streak" },
  { id: "streak_7", name: "On Fire", icon: "⚡", desc: "7-day streak" },
  { id: "streak_30", name: "Legendary", icon: "👑", desc: "30-day streak" },
  { id: "games_10", name: "Regular", icon: "📅", desc: "Play 10 days" },
  { id: "games_50", name: "Devotee", icon: "💎", desc: "Play 50 days" },
  { id: "speed_demon", name: "Speed Demon", icon: "💨", desc: "All 5 under 5s each" },
  { id: "perfect_5", name: "Perfectionist", icon: "🏆", desc: "5 perfect games" },
  { id: "perfect_20", name: "Mastermind", icon: "🧠", desc: "20 perfect games" },
  { id: "lightning", name: "Lightning Round", icon: "⏱️", desc: `All ${QUESTIONS_PER_QUIZ} in under 15s total` },
];

function calculateBadges(player, timings, correct) {
  const existing = JSON.parse(player.badges || "[]");
  const earned = [...existing];

  const checks = {
    first_perfect: player.perfect_games >= 1,
    streak_3: player.streak >= 3,
    streak_7: player.streak >= 7,
    streak_30: player.streak >= 30,
    games_10: player.total_games >= 10,
    games_50: player.total_games >= 50,
    speed_demon: correct.every(Boolean) && timings.every((t) => t !== null && t < 5),
    perfect_5: player.perfect_games >= 5,
    perfect_20: player.perfect_games >= 20,
    lightning: timings.reduce((a, t) => a + (t === null ? QUESTION_TIME_LIMIT : t), 0) < 15,
  };

  const newBadges = [];
  for (const [id, condition] of Object.entries(checks)) {
    if (condition && !earned.includes(id)) {
      earned.push(id);
      newBadges.push(BADGE_DEFINITIONS.find((b) => b.id === id));
    }
  }

  if (newBadges.length > 0) {
    const dbInstance = db.getDb();
    dbInstance.prepare("UPDATE players SET badges = ? WHERE id = ?").run(JSON.stringify(earned), player.id);
  }

  return {
    new: newBadges,
    all: BADGE_DEFINITIONS.map((b) => ({
      ...b,
      unlocked: earned.includes(b.id),
    })),
  };
}

// ═══════════════════════════════════════
// PLAYER ROUTES
// ═══════════════════════════════════════

// Register anonymous player
app.post("/api/player/register", (req, res) => {
  const { display_name } = req.body;
  const token = auth.generatePlayerToken();
  const player = db.players.create(token, display_name || null);

  res.json({
    token: player.player_token,
    player: {
      display_name: player.display_name,
      streak: 0,
      total_games: 0,
      perfect_games: 0,
      total_score: 0,
    },
  });
});

// Get player stats
app.get("/api/player/stats", auth.playerAuthMiddleware, (req, res) => {
  const player = req.player;
  const badges = JSON.parse(player.badges || "[]");

  res.json({
    display_name: player.display_name,
    streak: player.streak,
    longest_streak: player.longest_streak,
    total_games: player.total_games,
    perfect_games: player.perfect_games,
    total_score: player.total_score,
    avg_score: player.total_games > 0 ? Math.round(player.total_score / player.total_games) : 0,
    badges: BADGE_DEFINITIONS.map((b) => ({
      ...b,
      unlocked: badges.includes(b.id),
    })),
    has_played_today: db.players.hasPlayedToday(player.id, getToday()),
  });
});

// Get today's result (if already played)
app.get("/api/player/today", auth.playerAuthMiddleware, (req, res) => {
  const result = db.players.getResult(req.player.id, getToday());
  if (!result) {
    return res.json({ played: false });
  }
  res.json({ played: true, result });
});

// Get today's leaderboard
app.get("/api/player/leaderboard", auth.playerAuthMiddleware, (req, res) => {
  const today = getToday();
  const leaderboard = db.players.getLeaderboard(today, 10);
  res.json({ leaderboard, date: today });
});

// ═══════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════

// Admin login
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const token = await auth.validateAdminLogin(email, password);

  if (!token) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ token, email });
});

// --- Questions CRUD ---

app.get("/api/admin/questions", auth.adminAuthMiddleware, (req, res) => {
  const filters = {
    status: req.query.status,
    category: req.query.category,
    difficulty: req.query.difficulty,
    source: req.query.source,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };
  const questions = db.questions.getAll(filters);
  res.json({ questions, total: questions.length });
});

app.post("/api/admin/questions", auth.adminAuthMiddleware, (req, res) => {
  const { question, option_a, option_b, option_c, option_d, correct_answer, category, difficulty, status } = req.body;

  if (!question || !option_a || !option_b || !option_c || !option_d || correct_answer === undefined || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const created = db.questions.create({
    question, option_a, option_b, option_c, option_d,
    correct_answer, category, difficulty: difficulty || "medium",
    status: status || "approved", source: "manual",
  });

  res.json({ question: created });
});

app.put("/api/admin/questions/:id", auth.adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const result = db.questions.update(id, req.body);
  if (!result) {
    return res.status(404).json({ error: "Question not found" });
  }
  res.json({ question: db.questions.getById(id) });
});

app.delete("/api/admin/questions/:id", auth.adminAuthMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  db.questions.delete(id);
  res.json({ success: true });
});

app.post("/api/admin/questions/bulk", auth.adminAuthMiddleware, (req, res) => {
  const { ids, action } = req.body;
  if (!ids || !Array.isArray(ids) || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "Invalid bulk action" });
  }

  const status = action === "approve" ? "approved" : "rejected";
  for (const id of ids) {
    db.questions.update(id, { status });
  }

  res.json({ updated: ids.length, status });
});

app.get("/api/admin/questions/stats", auth.adminAuthMiddleware, (req, res) => {
  res.json(db.questions.getStats());
});

app.get("/api/admin/questions/categories", auth.adminAuthMiddleware, (req, res) => {
  res.json({ categories: db.questions.getCategories() });
});

// --- Schedule ---

app.get("/api/admin/schedule", auth.adminAuthMiddleware, (req, res) => {
  const start = req.query.start || getToday();
  const end = req.query.end || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const scheduled = db.schedule.getRange(start, end);
  const unscheduled = db.schedule.getUnscheduledDays(start, end);
  res.json({ scheduled, unscheduled });
});

app.post("/api/admin/schedule", auth.adminAuthMiddleware, (req, res) => {
  const { date, question_ids } = req.body;
  if (!date || !question_ids || question_ids.length !== QUESTIONS_PER_QUIZ) {
    return res.status(400).json({ error: `Need date and exactly ${QUESTIONS_PER_QUIZ} question IDs` });
  }

  db.schedule.create(date, question_ids[0], question_ids[1], question_ids[2], question_ids[3], question_ids[4], req.admin.email);
  const schedule = db.schedule.getByDate(date);
  res.json({ schedule });
});

app.post("/api/admin/schedule/auto", auth.adminAuthMiddleware, (req, res) => {
  const { dates } = req.body;
  if (!dates || !Array.isArray(dates)) {
    return res.status(400).json({ error: "Provide array of dates" });
  }

  const results = [];
  for (const date of dates) {
    const result = db.schedule.autoSchedule(date);
    results.push({ date, success: !!result });
  }

  res.json({ results });
});

app.post("/api/admin/schedule/publish", auth.adminAuthMiddleware, (req, res) => {
  const { date } = req.body;
  db.schedule.publish(date || getToday());
  res.json({ success: true });
});

// --- AI Generation ---

app.post("/api/admin/generate", auth.adminAuthMiddleware, middleware.aiGenerateLimiter, async (req, res) => {
  const { count = 21, categories } = req.body;

  try {
    const generateQuestions = require("../scripts/generate-questions");
    const batchId = db.batches.create(count);

    generateQuestions.generate(count, categories)
      .then((questions) => {
        const ids = db.questions.createBatch(questions);
        db.batches.complete(batchId, questions.length, 0);
      })
      .catch((err) => {
        db.batches.fail(batchId, err.message);
      });

    res.json({ batch_id: batchId, status: "running", message: `Generating ${count} questions...` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/generate/batches", auth.adminAuthMiddleware, (req, res) => {
  res.json({ batches: db.batches.getRecent() });
});

// --- Analytics ---

app.get("/api/admin/analytics", auth.adminAuthMiddleware, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  res.json({
    daily_stats: db.analytics.getDailyStats(days),
    total_players: db.analytics.getTotalPlayers(),
    active_players_7d: db.analytics.getActivePlayers(7),
    question_stats: db.questions.getStats(),
  });
});

// ═══════════════════════════════════════
// SERVE FRONTEND (production)
// ═══════════════════════════════════════

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
  });
}

app.use(middleware.errorHandler);

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════

db.setupDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🇿🇦 QuiZa API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Database: ${process.env.DATABASE_URL || "sportq.db"}\n`);
});

module.exports = app;
