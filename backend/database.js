// backend/database.js
// SQLite database layer — swap to PostgreSQL for production via env var

const path = require("path");

let db;

function getDb() {
  if (db) return db;
  const Database = require("better-sqlite3");
  const dbPath = process.env.DATABASE_URL || path.join(__dirname, "..", "sportq.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// ═══════════════════════════════════════
// SCHEMA SETUP
// ═══════════════════════════════════════

function setupDatabase() {
  const db = getDb();

  db.exec(`
    -- Questions bank
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer INTEGER NOT NULL CHECK(correct_answer BETWEEN 0 AND 3),
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'used')),
      source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai_generated', 'imported')),
      ai_confidence REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Daily schedule
    CREATE TABLE IF NOT EXISTS daily_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_date DATE NOT NULL UNIQUE,
      question_1_id INTEGER NOT NULL REFERENCES questions(id),
      question_2_id INTEGER NOT NULL REFERENCES questions(id),
      question_3_id INTEGER NOT NULL REFERENCES questions(id),
      is_published BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system'
    );

    -- Players (anonymous by default)
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_token TEXT UNIQUE NOT NULL,
      display_name TEXT,
      streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      perfect_games INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      badges TEXT DEFAULT '[]',
      last_played_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Game results
    CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id),
      quiz_date DATE NOT NULL,
      question_1_answer INTEGER,
      question_1_time REAL,
      question_1_correct BOOLEAN,
      question_2_answer INTEGER,
      question_2_time REAL,
      question_2_correct BOOLEAN,
      question_3_answer INTEGER,
      question_3_time REAL,
      question_3_correct BOOLEAN,
      score INTEGER NOT NULL DEFAULT 0,
      total_time REAL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, quiz_date)
    );

    -- AI generation batches
    CREATE TABLE IF NOT EXISTS generation_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_size INTEGER,
      questions_generated INTEGER DEFAULT 0,
      questions_approved INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
    CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
    CREATE INDEX IF NOT EXISTS idx_schedule_date ON daily_schedule(quiz_date);
    CREATE INDEX IF NOT EXISTS idx_players_token ON players(player_token);
    CREATE INDEX IF NOT EXISTS idx_results_player ON game_results(player_id);
    CREATE INDEX IF NOT EXISTS idx_results_date ON game_results(quiz_date);
  `);

  console.log("✅ Database tables created");
  return db;
}

// ═══════════════════════════════════════
// QUESTION QUERIES
// ═══════════════════════════════════════

const questionQueries = {
  getAll(filters = {}) {
    const db = getDb();
    let sql = "SELECT * FROM questions WHERE 1=1";
    const params = [];

    if (filters.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.category) {
      sql += " AND category = ?";
      params.push(filters.category);
    }
    if (filters.difficulty) {
      sql += " AND difficulty = ?";
      params.push(filters.difficulty);
    }
    if (filters.source) {
      sql += " AND source = ?";
      params.push(filters.source);
    }

    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    return db.prepare(sql).all(...params);
  },

  getById(id) {
    return getDb().prepare("SELECT * FROM questions WHERE id = ?").get(id);
  },

  create(q) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer, category, difficulty, status, source, ai_confidence, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      q.question, q.option_a, q.option_b, q.option_c, q.option_d,
      q.correct_answer, q.category, q.difficulty || "medium",
      q.status || "pending", q.source || "manual",
      q.ai_confidence || null, q.notes || null
    );
    return { id: result.lastInsertRowid, ...q };
  },

  createBatch(questions) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer, category, difficulty, status, source, ai_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((items) => {
      const results = [];
      for (const q of items) {
        const r = stmt.run(
          q.question, q.option_a, q.option_b, q.option_c, q.option_d,
          q.correct_answer, q.category, q.difficulty || "medium",
          q.status || "pending", q.source || "ai_generated",
          q.ai_confidence || null
        );
        results.push(r.lastInsertRowid);
      }
      return results;
    });
    return insertMany(questions);
  },

  update(id, updates) {
    const db = getDb();
    const fields = [];
    const params = [];

    const allowed = ["question", "option_a", "option_b", "option_c", "option_d",
      "correct_answer", "category", "difficulty", "status", "notes"];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (fields.length === 0) return null;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    return db.prepare(`UPDATE questions SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  },

  delete(id) {
    return getDb().prepare("DELETE FROM questions WHERE id = ?").run(id);
  },

  getStats() {
    const db = getDb();
    return {
      total: db.prepare("SELECT COUNT(*) as count FROM questions").get().count,
      pending: db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'pending'").get().count,
      approved: db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'approved'").get().count,
      used: db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'used'").get().count,
      rejected: db.prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'rejected'").get().count,
      byCategory: db.prepare(`
        SELECT category, COUNT(*) as count, status
        FROM questions
        GROUP BY category, status
        ORDER BY category
      `).all(),
    };
  },

  getCategories() {
    return getDb().prepare("SELECT DISTINCT category FROM questions ORDER BY category").all().map(r => r.category);
  },
};

// ═══════════════════════════════════════
// SCHEDULE QUERIES
// ═══════════════════════════════════════

const scheduleQueries = {
  getByDate(date) {
    const db = getDb();
    const schedule = db.prepare(`
      SELECT ds.*, 
        q1.question as q1_text, q1.option_a as q1_a, q1.option_b as q1_b, q1.option_c as q1_c, q1.option_d as q1_d, q1.correct_answer as q1_answer, q1.category as q1_category, q1.difficulty as q1_difficulty,
        q2.question as q2_text, q2.option_a as q2_a, q2.option_b as q2_b, q2.option_c as q2_c, q2.option_d as q2_d, q2.correct_answer as q2_answer, q2.category as q2_category, q2.difficulty as q2_difficulty,
        q3.question as q3_text, q3.option_a as q3_a, q3.option_b as q3_b, q3.option_c as q3_c, q3.option_d as q3_d, q3.correct_answer as q3_answer, q3.category as q3_category, q3.difficulty as q3_difficulty
      FROM daily_schedule ds
      JOIN questions q1 ON ds.question_1_id = q1.id
      JOIN questions q2 ON ds.question_2_id = q2.id
      JOIN questions q3 ON ds.question_3_id = q3.id
      WHERE ds.quiz_date = ?
    `).get(date);

    if (!schedule) return null;

    return {
      date: schedule.quiz_date,
      is_published: schedule.is_published,
      questions: [
        { id: schedule.question_1_id, question: schedule.q1_text, options: [schedule.q1_a, schedule.q1_b, schedule.q1_c, schedule.q1_d], correct_answer: schedule.q1_answer, category: schedule.q1_category, difficulty: schedule.q1_difficulty },
        { id: schedule.question_2_id, question: schedule.q2_text, options: [schedule.q2_a, schedule.q2_b, schedule.q2_c, schedule.q2_d], correct_answer: schedule.q2_answer, category: schedule.q2_category, difficulty: schedule.q2_difficulty },
        { id: schedule.question_3_id, question: schedule.q3_text, options: [schedule.q3_a, schedule.q3_b, schedule.q3_c, schedule.q3_d], correct_answer: schedule.q3_answer, category: schedule.q3_category, difficulty: schedule.q3_difficulty },
      ],
    };
  },

  getRange(startDate, endDate) {
    return getDb().prepare(`
      SELECT ds.*, 
        q1.category as q1_category, q2.category as q2_category, q3.category as q3_category
      FROM daily_schedule ds
      JOIN questions q1 ON ds.question_1_id = q1.id
      JOIN questions q2 ON ds.question_2_id = q2.id
      JOIN questions q3 ON ds.question_3_id = q3.id
      WHERE ds.quiz_date BETWEEN ? AND ?
      ORDER BY ds.quiz_date ASC
    `).all(startDate, endDate);
  },

  create(date, q1Id, q2Id, q3Id, createdBy = "system") {
    const db = getDb();
    return db.prepare(`
      INSERT OR REPLACE INTO daily_schedule (quiz_date, question_1_id, question_2_id, question_3_id, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, q1Id, q2Id, q3Id, createdBy);
  },

  publish(date) {
    return getDb().prepare("UPDATE daily_schedule SET is_published = 1 WHERE quiz_date = ?").run(date);
  },

  getUnscheduledDays(startDate, endDate) {
    const db = getDb();
    const scheduled = db.prepare(
      "SELECT quiz_date FROM daily_schedule WHERE quiz_date BETWEEN ? AND ?"
    ).all(startDate, endDate).map(r => r.quiz_date);

    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      if (!scheduled.includes(dateStr)) days.push(dateStr);
      current.setDate(current.getDate() + 1);
    }
    return days;
  },

  autoSchedule(date) {
    const db = getDb();
    // Pick 1 SA, 1 global, 1 wildcard from approved questions
    const saCategories = ["SA Rugby", "SA Cricket", "SA Football"];
    const globalCategories = ["Formula 1", "Golf", "Tennis", "Premier League", "Champions League", "Olympics", "World Football"];

    const saQ = db.prepare(`
      SELECT id FROM questions 
      WHERE status = 'approved' AND category IN (${saCategories.map(() => "?").join(",")})
      ORDER BY RANDOM() LIMIT 1
    `).get(...saCategories);

    const globalQ = db.prepare(`
      SELECT id FROM questions 
      WHERE status = 'approved' AND category IN (${globalCategories.map(() => "?").join(",")})
      AND id != ?
      ORDER BY RANDOM() LIMIT 1
    `).get(...globalCategories, saQ?.id || 0);

    const wildcardQ = db.prepare(`
      SELECT id FROM questions 
      WHERE status = 'approved' AND id NOT IN (?, ?)
      ORDER BY RANDOM() LIMIT 1
    `).get(saQ?.id || 0, globalQ?.id || 0);

    if (!saQ || !globalQ || !wildcardQ) return null;

    return scheduleQueries.create(date, saQ.id, globalQ.id, wildcardQ.id, "auto");
  },
};

// ═══════════════════════════════════════
// PLAYER QUERIES
// ═══════════════════════════════════════

const playerQueries = {
  create(token, displayName) {
    const db = getDb();
    db.prepare("INSERT INTO players (player_token, display_name) VALUES (?, ?)").run(token, displayName);
    return playerQueries.getByToken(token);
  },

  getByToken(token) {
    return getDb().prepare("SELECT * FROM players WHERE player_token = ?").get(token);
  },

  getById(id) {
    return getDb().prepare("SELECT * FROM players WHERE id = ?").get(id);
  },

  updateStats(playerId, score, isPerfect, quizDate) {
    const db = getDb();
    const player = playerQueries.getById(playerId);
    if (!player) return null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const newStreak = player.last_played_date === yesterdayStr ? player.streak + 1 : 1;
    const newLongest = Math.max(player.longest_streak, newStreak);

    db.prepare(`
      UPDATE players SET
        streak = ?, longest_streak = ?, total_games = total_games + 1,
        perfect_games = perfect_games + ?, total_score = total_score + ?,
        last_played_date = ?
      WHERE id = ?
    `).run(newStreak, newLongest, isPerfect ? 1 : 0, score, quizDate, playerId);

    return playerQueries.getById(playerId);
  },

  hasPlayedToday(playerId, date) {
    return getDb().prepare(
      "SELECT COUNT(*) as count FROM game_results WHERE player_id = ? AND quiz_date = ?"
    ).get(playerId, date).count > 0;
  },

  saveResult(playerId, quizDate, result) {
    const db = getDb();
    return db.prepare(`
      INSERT INTO game_results (player_id, quiz_date,
        question_1_answer, question_1_time, question_1_correct,
        question_2_answer, question_2_time, question_2_correct,
        question_3_answer, question_3_time, question_3_correct,
        score, total_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId, quizDate,
      result.answers[0], result.timings[0], result.correct[0] ? 1 : 0,
      result.answers[1], result.timings[1], result.correct[1] ? 1 : 0,
      result.answers[2], result.timings[2], result.correct[2] ? 1 : 0,
      result.score, result.totalTime
    );
  },

  getResult(playerId, date) {
    return getDb().prepare(
      "SELECT * FROM game_results WHERE player_id = ? AND quiz_date = ?"
    ).get(playerId, date);
  },

  getLeaderboard(date, limit = 20) {
    return getDb().prepare(`
      SELECT gr.score, gr.total_time, p.display_name, p.streak
      FROM game_results gr
      JOIN players p ON gr.player_id = p.id
      WHERE gr.quiz_date = ?
      ORDER BY gr.score DESC, gr.total_time ASC
      LIMIT ?
    `).all(date, limit);
  },
};

// ═══════════════════════════════════════
// ANALYTICS QUERIES
// ═══════════════════════════════════════

const analyticsQueries = {
  getDailyStats(days = 30) {
    return getDb().prepare(`
      SELECT quiz_date, COUNT(*) as players, 
        AVG(score) as avg_score, 
        SUM(CASE WHEN score = 300 THEN 1 ELSE 0 END) as perfect_count,
        AVG(total_time) as avg_time
      FROM game_results
      WHERE quiz_date >= date('now', '-' || ? || ' days')
      GROUP BY quiz_date
      ORDER BY quiz_date DESC
    `).all(days);
  },

  getTotalPlayers() {
    return getDb().prepare("SELECT COUNT(*) as count FROM players").get().count;
  },

  getActivePlayers(days = 7) {
    return getDb().prepare(`
      SELECT COUNT(DISTINCT player_id) as count 
      FROM game_results 
      WHERE quiz_date >= date('now', '-' || ? || ' days')
    `).all(days)[0]?.count || 0;
  },

  getCategoryPerformance() {
    return getDb().prepare(`
      SELECT q.category, 
        COUNT(*) as times_served,
        AVG(CASE WHEN gr.question_1_correct THEN 1.0 ELSE 0.0 END) as correct_rate
      FROM daily_schedule ds
      JOIN questions q ON ds.question_1_id = q.id
      JOIN game_results gr ON gr.quiz_date = ds.quiz_date
      GROUP BY q.category
    `).all();
  },
};

// ═══════════════════════════════════════
// GENERATION BATCH QUERIES
// ═══════════════════════════════════════

const batchQueries = {
  create(batchSize) {
    const db = getDb();
    const result = db.prepare(
      "INSERT INTO generation_batches (batch_size, status) VALUES (?, 'running')"
    ).run(batchSize);
    return result.lastInsertRowid;
  },

  complete(id, generated, approved) {
    getDb().prepare(`
      UPDATE generation_batches 
      SET status = 'completed', questions_generated = ?, questions_approved = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(generated, approved, id);
  },

  fail(id, error) {
    getDb().prepare(`
      UPDATE generation_batches SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(error, id);
  },

  getRecent(limit = 10) {
    return getDb().prepare("SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT ?").all(limit);
  },
};

module.exports = {
  getDb,
  setupDatabase,
  questions: questionQueries,
  schedule: scheduleQueries,
  players: playerQueries,
  analytics: analyticsQueries,
  batches: batchQueries,
};
