require("dotenv").config();
const db = require("../backend/database");
db.setupDatabase();
const d = db.getDb();
const r1 = d.prepare("DELETE FROM game_results WHERE quiz_date = '2026-03-25'").run();
const r2 = d.prepare("DELETE FROM game_results WHERE quiz_date = '2026-03-24'").run();
console.log("Deleted March 25:", r1.changes);
console.log("Deleted March 24:", r2.changes);
