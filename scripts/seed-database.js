// scripts/seed-database.js
// Seeds the database with initial question bank and schedules

require("dotenv").config();
const db = require("../backend/database");

const SEED_QUESTIONS = [
  // === SA RUGBY ===
  { question: "Who captained the Springboks to victory in the 2023 Rugby World Cup?", option_a: "Eben Etzebeth", option_b: "Siya Kolisi", option_c: "Handré Pollard", option_d: "Pieter-Steph du Toit", correct_answer: 1, category: "SA Rugby", difficulty: "easy" },
  { question: "How many Rugby World Cups have the Springboks won?", option_a: "2", option_b: "3", option_c: "4", option_d: "5", correct_answer: 2, category: "SA Rugby", difficulty: "easy" },
  { question: "Which Springbok holds the record for most test tries?", option_a: "Bryan Habana", option_b: "Cheslin Kolbe", option_c: "Joost van der Westhuizen", option_d: "Jaque Fourie", correct_answer: 0, category: "SA Rugby", difficulty: "medium" },
  { question: "In which year did the Springboks win their first Rugby World Cup?", option_a: "1991", option_b: "1995", option_c: "1999", option_d: "2003", correct_answer: 1, category: "SA Rugby", difficulty: "easy" },
  { question: "Who kicked the winning penalty in the 2019 RWC final?", option_a: "Elton Jantjies", option_b: "Morné Steyn", option_c: "Handré Pollard", option_d: "Frans Steyn", correct_answer: 2, category: "SA Rugby", difficulty: "medium" },
  { question: "Which SA rugby team plays at Loftus Versfeld?", option_a: "Stormers", option_b: "Sharks", option_c: "Bulls", option_d: "Lions", correct_answer: 2, category: "SA Rugby", difficulty: "easy" },
  { question: "Who coached the Springboks to the 2023 World Cup victory?", option_a: "Allister Coetzee", option_b: "Heyneke Meyer", option_c: "Jacques Nienaber", option_d: "Rassie Erasmus", correct_answer: 3, category: "SA Rugby", difficulty: "medium" },
  { question: "Which Springbok lock won World Rugby Player of the Year in 2023?", option_a: "Lood de Jager", option_b: "Eben Etzebeth", option_c: "RG Snyman", option_d: "Pieter-Steph du Toit", correct_answer: 3, category: "SA Rugby", difficulty: "hard" },
  { question: "At which stadium did the Springboks win the 1995 World Cup final?", option_a: "Loftus Versfeld", option_b: "Ellis Park", option_c: "Newlands", option_d: "FNB Stadium", correct_answer: 1, category: "SA Rugby", difficulty: "medium" },

  // === SA CRICKET ===
  { question: "Who is South Africa's all-time leading run scorer in Test cricket?", option_a: "Hashim Amla", option_b: "Jacques Kallis", option_c: "Graeme Smith", option_d: "AB de Villiers", correct_answer: 1, category: "SA Cricket", difficulty: "medium" },
  { question: "Which SA cricketer holds the record for the fastest ODI century?", option_a: "Herschelle Gibbs", option_b: "AB de Villiers", option_c: "Quinton de Kock", option_d: "David Miller", correct_answer: 1, category: "SA Cricket", difficulty: "easy" },
  { question: "Who famously hit 6 sixes in an over in a 2007 World Cup match?", option_a: "AB de Villiers", option_b: "Herschelle Gibbs", option_c: "Jacques Kallis", option_d: "Lance Klusener", correct_answer: 1, category: "SA Cricket", difficulty: "medium" },
  { question: "Which ground is known as 'The Bullring' in SA cricket?", option_a: "Newlands", option_b: "SuperSport Park", option_c: "The Wanderers", option_d: "Kingsmead", correct_answer: 2, category: "SA Cricket", difficulty: "medium" },
  { question: "How many balls did AB de Villiers face for his record 31-ball ODI century?", option_a: "31", option_b: "44", option_c: "36", option_d: "28", correct_answer: 0, category: "SA Cricket", difficulty: "medium" },
  { question: "Which SA fast bowler was known as 'White Lightning'?", option_a: "Shaun Pollock", option_b: "Makhaya Ntini", option_c: "Allan Donald", option_d: "Dale Steyn", correct_answer: 2, category: "SA Cricket", difficulty: "medium" },

  // === SA FOOTBALL ===
  { question: "Which club has won the most PSL titles?", option_a: "Orlando Pirates", option_b: "Kaizer Chiefs", option_c: "Mamelodi Sundowns", option_d: "SuperSport United", correct_answer: 2, category: "SA Football", difficulty: "easy" },
  { question: "What is the nickname of Kaizer Chiefs?", option_a: "The Brazilians", option_b: "Amakhosi", option_c: "The Buccaneers", option_d: "Matsatsantsa", correct_answer: 1, category: "SA Football", difficulty: "easy" },
  { question: "Which SA club won the CAF Champions League in 2016?", option_a: "Orlando Pirates", option_b: "Kaizer Chiefs", option_c: "Mamelodi Sundowns", option_d: "Bidvest Wits", correct_answer: 2, category: "SA Football", difficulty: "medium" },
  { question: "Where is the Soweto Derby typically played?", option_a: "Moses Mabhida", option_b: "FNB Stadium", option_c: "Cape Town Stadium", option_d: "Ellis Park", correct_answer: 1, category: "SA Football", difficulty: "easy" },
  { question: "Who is Bafana Bafana's all-time top scorer?", option_a: "Benni McCarthy", option_b: "Siphiwe Tshabalala", option_c: "Steven Pienaar", option_d: "Bernard Parker", correct_answer: 0, category: "SA Football", difficulty: "medium" },
  { question: "In which year did Bafana Bafana win the Africa Cup of Nations?", option_a: "1994", option_b: "1996", option_c: "1998", option_d: "2000", correct_answer: 1, category: "SA Football", difficulty: "medium" },
  { question: "Which SA stadium hosted the 2010 FIFA World Cup final?", option_a: "Moses Mabhida", option_b: "Ellis Park", option_c: "FNB Stadium", option_d: "Cape Town Stadium", correct_answer: 2, category: "SA Football", difficulty: "easy" },

  // === FORMULA 1 ===
  { question: "Who won the 2023 F1 World Championship?", option_a: "Lewis Hamilton", option_b: "Max Verstappen", option_c: "Charles Leclerc", option_d: "Lando Norris", correct_answer: 1, category: "Formula 1", difficulty: "easy" },
  { question: "Which team does Max Verstappen drive for?", option_a: "Ferrari", option_b: "Mercedes", option_c: "Red Bull Racing", option_d: "McLaren", correct_answer: 2, category: "Formula 1", difficulty: "easy" },
  { question: "How many F1 World Championships has Lewis Hamilton won?", option_a: "5", option_b: "6", option_c: "7", option_d: "8", correct_answer: 2, category: "Formula 1", difficulty: "easy" },
  { question: "Which F1 circuit is known as 'The Temple of Speed'?", option_a: "Silverstone", option_b: "Monaco", option_c: "Monza", option_d: "Spa-Francorchamps", correct_answer: 2, category: "Formula 1", difficulty: "medium" },
  { question: "Which South African won the F1 World Championship in 1979?", option_a: "Jody Scheckter", option_b: "Ian Scheckter", option_c: "Desiré Wilson", option_d: "Dave Charlton", correct_answer: 0, category: "Formula 1", difficulty: "medium" },
  { question: "How many races did Max Verstappen win in his record-breaking 2023 season?", option_a: "15", option_b: "17", option_c: "19", option_d: "21", correct_answer: 2, category: "Formula 1", difficulty: "hard" },
  { question: "Which F1 team is based in Maranello, Italy?", option_a: "McLaren", option_b: "Alpine", option_c: "Ferrari", option_d: "AlphaTauri", correct_answer: 2, category: "Formula 1", difficulty: "easy" },

  // === GOLF ===
  { question: "How many major championships has Ernie Els won?", option_a: "2", option_b: "3", option_c: "4", option_d: "5", correct_answer: 2, category: "Golf", difficulty: "medium" },
  { question: "At which course is The Masters played every year?", option_a: "St Andrews", option_b: "Pebble Beach", option_c: "Augusta National", option_d: "Royal Melbourne", correct_answer: 2, category: "Golf", difficulty: "easy" },
  { question: "How many major championships has Tiger Woods won?", option_a: "12", option_b: "15", option_c: "18", option_d: "14", correct_answer: 1, category: "Golf", difficulty: "easy" },
  { question: "Which SA golfer won the 2010 Open Championship at St Andrews?", option_a: "Retief Goosen", option_b: "Ernie Els", option_c: "Louis Oosthuizen", option_d: "Tim Clark", correct_answer: 2, category: "Golf", difficulty: "medium" },
  { question: "What is the nickname of Gary Player?", option_a: "The Golden Bear", option_b: "The Black Knight", option_c: "The Shark", option_d: "The Big Easy", correct_answer: 1, category: "Golf", difficulty: "medium" },
  { question: "How many major championships did Gary Player win?", option_a: "6", option_b: "7", option_c: "9", option_d: "11", correct_answer: 2, category: "Golf", difficulty: "medium" },
  { question: "Which SA golfer won the inaugural LIV Golf individual event?", option_a: "Louis Oosthuizen", option_b: "Charl Schwartzel", option_c: "Branden Grace", option_d: "Erik van Rooyen", correct_answer: 1, category: "Golf", difficulty: "hard" },

  // === TENNIS ===
  { question: "How many Grand Slam singles titles has Novak Djokovic won?", option_a: "20", option_b: "22", option_c: "24", option_d: "18", correct_answer: 2, category: "Tennis", difficulty: "easy" },
  { question: "On which surface is the French Open played?", option_a: "Grass", option_b: "Hard court", option_c: "Clay", option_d: "Carpet", correct_answer: 2, category: "Tennis", difficulty: "easy" },
  { question: "Who holds the record for most Wimbledon singles titles?", option_a: "Pete Sampras", option_b: "Novak Djokovic", option_c: "Roger Federer", option_d: "Rafael Nadal", correct_answer: 2, category: "Tennis", difficulty: "medium" },
  { question: "Which Grand Slam is played first each calendar year?", option_a: "French Open", option_b: "US Open", option_c: "Wimbledon", option_d: "Australian Open", correct_answer: 3, category: "Tennis", difficulty: "easy" },
  { question: "Which SA tennis player reached the 2017 US Open final?", option_a: "Wayne Ferreira", option_b: "Kevin Anderson", option_c: "Johan Kriek", option_d: "Raven Klaasen", correct_answer: 1, category: "Tennis", difficulty: "medium" },

  // === PREMIER LEAGUE ===
  { question: "Which club has won the most Premier League titles?", option_a: "Liverpool", option_b: "Chelsea", option_c: "Arsenal", option_d: "Manchester United", correct_answer: 3, category: "Premier League", difficulty: "easy" },
  { question: "Which SA-born player captained Leeds United in the Premier League?", option_a: "Steven Pienaar", option_b: "Lucas Radebe", option_c: "Aaron Mokoena", option_d: "Benni McCarthy", correct_answer: 1, category: "Premier League", difficulty: "medium" },
  { question: "Which club won the Premier League in the 'Invincibles' season?", option_a: "Manchester United", option_b: "Chelsea", option_c: "Arsenal", option_d: "Manchester City", correct_answer: 2, category: "Premier League", difficulty: "easy" },
  { question: "Who is the Premier League's all-time top scorer?", option_a: "Wayne Rooney", option_b: "Alan Shearer", option_c: "Thierry Henry", option_d: "Erling Haaland", correct_answer: 1, category: "Premier League", difficulty: "easy" },
  { question: "Which team famously won the 2015-16 Premier League as 5000-1 outsiders?", option_a: "Burnley", option_b: "Leicester City", option_c: "Wolverhampton", option_d: "Southampton", correct_answer: 1, category: "Premier League", difficulty: "easy" },

  // === CHAMPIONS LEAGUE ===
  { question: "Which club has won the most UEFA Champions League titles?", option_a: "AC Milan", option_b: "Barcelona", option_c: "Real Madrid", option_d: "Bayern Munich", correct_answer: 2, category: "Champions League", difficulty: "easy" },
  { question: "How many Champions League titles has Lionel Messi won?", option_a: "2", option_b: "3", option_c: "4", option_d: "5", correct_answer: 2, category: "Champions League", difficulty: "medium" },
  { question: "In which year was the Champions League final known as the 'Miracle of Istanbul'?", option_a: "2003", option_b: "2005", option_c: "2007", option_d: "2009", correct_answer: 1, category: "Champions League", difficulty: "medium" },

  // === OLYMPICS ===
  { question: "Which SA athlete set the 400m world record at the 2016 Olympics?", option_a: "Akani Simbine", option_b: "Wayde van Niekerk", option_c: "Oscar Pistorius", option_d: "Henricho Bruintjies", correct_answer: 1, category: "Olympics", difficulty: "easy" },
  { question: "In which Olympic sport did Cameron van der Burgh win gold for SA?", option_a: "Rowing", option_b: "Swimming", option_c: "Cycling", option_d: "Athletics", correct_answer: 1, category: "Olympics", difficulty: "medium" },
  { question: "Who holds the record for most Olympic gold medals overall?", option_a: "Usain Bolt", option_b: "Carl Lewis", option_c: "Michael Phelps", option_d: "Mark Spitz", correct_answer: 2, category: "Olympics", difficulty: "easy" },
  { question: "In which year did South Africa return to the Olympics after the apartheid ban?", option_a: "1988", option_b: "1992", option_c: "1996", option_d: "1994", correct_answer: 1, category: "Olympics", difficulty: "medium" },
  { question: "Which SA swimmer won gold at the 2020 Tokyo Olympics?", option_a: "Chad le Clos", option_b: "Cameron van der Burgh", option_c: "Tatjana Schoenmaker", option_d: "Roland Schoeman", correct_answer: 2, category: "Olympics", difficulty: "medium" },

  // === WORLD FOOTBALL ===
  { question: "Which country has won the most FIFA World Cups?", option_a: "Germany", option_b: "Argentina", option_c: "Italy", option_d: "Brazil", correct_answer: 3, category: "World Football", difficulty: "easy" },
  { question: "Who scored the opening goal of the 2010 FIFA World Cup in South Africa?", option_a: "Katlego Mphela", option_b: "Siphiwe Tshabalala", option_c: "Steven Pienaar", option_d: "Benni McCarthy", correct_answer: 1, category: "World Football", difficulty: "easy" },
  { question: "Which country hosted the first ever FIFA World Cup in 1930?", option_a: "Brazil", option_b: "Italy", option_c: "France", option_d: "Uruguay", correct_answer: 3, category: "World Football", difficulty: "medium" },
  { question: "Which country won the 2022 FIFA World Cup in Qatar?", option_a: "France", option_b: "Argentina", option_c: "Brazil", option_d: "Croatia", correct_answer: 1, category: "World Football", difficulty: "easy" },
];

// ═══════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════

function seed() {
  console.log("\n🌱 Setting up SportQ database...\n");

  // Setup tables
  db.setupDatabase();

  // Check if already seeded
  const existing = db.questions.getAll();
  if (existing.length > 0 && !process.argv.includes("--force")) {
    console.log(`⚠️  Database already has ${existing.length} questions.`);
    console.log("   Use --force to re-seed.\n");
    return;
  }

  // Insert seed questions as approved
  const questions = SEED_QUESTIONS.map((q) => ({
    ...q,
    status: "approved",
    source: "manual",
    ai_confidence: 1.0,
  }));

  const ids = db.questions.createBatch(questions);
  console.log(`✅ Seeded ${ids.length} questions`);

  // Print category breakdown
  const categories = {};
  questions.forEach((q) => {
    categories[q.category] = (categories[q.category] || 0) + 1;
  });
  console.log("\n📊 Category breakdown:");
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

  // Auto-schedule first 7 days
  console.log("\n📅 Scheduling first 7 days...");
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    const result = db.schedule.autoSchedule(dateStr);
    if (result) {
      db.schedule.publish(dateStr);
      console.log(`   ✅ ${dateStr} — scheduled and published`);
    } else {
      console.log(`   ❌ ${dateStr} — not enough approved questions`);
    }
  }

  console.log("\n🎉 Seed complete! Start the server with: npm run dev\n");
}

// Run
if (process.argv.includes("--setup")) {
  db.setupDatabase();
  console.log("✅ Database tables created");
} else {
  seed();
}
