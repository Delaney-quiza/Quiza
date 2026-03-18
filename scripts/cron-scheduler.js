// scripts/cron-scheduler.js
// Runs daily cron jobs for question scheduling and weekly AI generation

require("dotenv").config();
const { CronJob } = require("cron");
const db = require("../backend/database");

// Initialize database
db.setupDatabase();

// ═══════════════════════════════════════
// DAILY: Auto-schedule upcoming days
// Runs at midnight every day
// ═══════════════════════════════════════

const dailyScheduler = new CronJob("0 0 * * *", () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Daily scheduler running...`);

  // Ensure next 7 days are scheduled
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const existing = db.schedule.getByDate(dateStr);
    if (!existing) {
      const result = db.schedule.autoSchedule(dateStr);
      if (result) {
        db.schedule.publish(dateStr);
        console.log(`   ✅ Auto-scheduled ${dateStr}`);
      } else {
        console.log(`   ⚠️ Could not schedule ${dateStr} — not enough approved questions`);
      }
    }
  }

  // Check question buffer
  const stats = db.questions.getStats();
  if (stats.approved < 30) {
    console.log(`   ⚠️ Low question buffer: only ${stats.approved} approved questions remaining`);
    console.log("   Run 'npm run generate' to create more questions");
  }
});

// ═══════════════════════════════════════
// WEEKLY: Generate AI questions
// Runs every Monday at 6am
// ═══════════════════════════════════════

const weeklyGenerator = new CronJob("0 6 * * 1", async () => {
  console.log(`\n🤖 [${new Date().toISOString()}] Weekly AI generation running...`);

  try {
    const { generate } = require("./generate-questions");
    const batchId = db.batches.create(21);

    const questions = await generate(21);
    if (questions.length > 0) {
      const ids = db.questions.createBatch(questions);
      db.batches.complete(batchId, questions.length, 0);
      console.log(`   ✅ Generated ${questions.length} questions (pending review)`);
    }
  } catch (err) {
    console.error(`   ❌ Generation failed: ${err.message}`);
  }
});

// ═══════════════════════════════════════
// START CRON JOBS
// ═══════════════════════════════════════

console.log("\n🕐 SportQ Cron Scheduler started");
console.log("   Daily scheduling: midnight");
console.log("   Weekly AI generation: Monday 6am\n");

dailyScheduler.start();
weeklyGenerator.start();

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n👋 Stopping cron scheduler...");
  dailyScheduler.stop();
  weeklyGenerator.stop();
  process.exit(0);
});
