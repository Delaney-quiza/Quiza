// scripts/generate-questions.js
// AI-powered question generation pipeline using Anthropic Claude API
// Generates SA-weighted sports trivia questions with built-in validation

require("dotenv").config();

const CATEGORIES = {
  sa: [
    { name: "SA Rugby", weight: 15, context: "South African rugby — Springboks, URC teams (Bulls, Stormers, Sharks, Lions), Rugby World Cup history, legendary players (Siya Kolisi, Bryan Habana, Francois Pienaar, Eben Etzebeth, Cheslin Kolbe), coaches (Rassie Erasmus, Jake White), Currie Cup, test match history" },
    { name: "SA Cricket", weight: 10, context: "South African cricket — Proteas, SA20 league, IPL connections, legendary players (Jacques Kallis, AB de Villiers, Hashim Amla, Dale Steyn, Graeme Smith, Allan Donald, Shaun Pollock), iconic grounds (Wanderers, Newlands, SuperSport Park), historic moments, World Cup campaigns" },
    { name: "SA Football", weight: 15, context: "South African football — PSL (Mamelodi Sundowns, Kaizer Chiefs, Orlando Pirates, SuperSport United), Bafana Bafana, 2010 FIFA World Cup in South Africa, CAF Champions League, legendary players (Benni McCarthy, Lucas Radebe, Steven Pienaar, Doctor Khumalo, Mark Fish), Soweto Derby" },
  ],
  global: [
    { name: "Formula 1", weight: 12, context: "Formula 1 racing — current grid (Verstappen, Hamilton, Leclerc, Norris, Sainz, Russell), teams (Red Bull, Ferrari, Mercedes, McLaren), circuits (Monaco, Silverstone, Monza, Spa), records, history, South African connection (Jody Scheckter), recent seasons" },
    { name: "Golf", weight: 10, context: "Professional golf — majors (Masters, US Open, The Open, PGA), PGA Tour, LIV Golf, Ryder Cup, SA golfers (Ernie Els, Gary Player, Louis Oosthuizen, Charl Schwartzel, Retief Goosen, Branden Grace), Tiger Woods, famous courses (Augusta, St Andrews, Pebble Beach)" },
    { name: "Tennis", weight: 8, context: "Professional tennis — Grand Slams (Australian Open, French Open, Wimbledon, US Open), ATP/WTA, Djokovic, Nadal, Federer era, current stars (Alcaraz, Sinner, Swiatek), SA players (Kevin Anderson, Amanda Coetzer, Johan Kriek), Davis Cup" },
    { name: "Premier League", weight: 12, context: "English Premier League — top clubs (Manchester City, Arsenal, Liverpool, Manchester United, Chelsea, Tottenham), records, iconic moments, all-time greats, SA connections (Lucas Radebe, Benni McCarthy, Steven Pienaar, Aaron Mokoena), current season, historic seasons" },
    { name: "Champions League", weight: 6, context: "UEFA Champions League — Real Madrid dominance, historic finals, iconic goals and moments, current competition, SA player appearances, group stages and knockout drama" },
    { name: "Olympics", weight: 6, context: "Olympic Games — summer and winter, athletics, swimming, SA medalists (Wayde van Niekerk, Chad le Clos, Cameron van der Burgh, Caster Semenya, Tatjana Schoenmaker), world records, historic moments, host cities" },
    { name: "World Football", weight: 6, context: "International football — FIFA World Cup history, continental tournaments (AFCON, Euros, Copa America), international records, iconic World Cup moments, 2010 South Africa World Cup specifically" },
  ],
};

const SYSTEM_PROMPT = `You are a sports trivia question generator for SportQ, a daily quiz app targeting South African sports fans.

RULES:
1. Generate multiple-choice questions with EXACTLY 4 options each
2. Questions must be factually accurate and verifiable
3. Wrong answers (distractors) should be plausible but clearly wrong to someone who knows the topic
4. Mix difficulty levels: ~30% easy (widely known facts), ~50% medium (sports enthusiast level), ~20% hard (deep knowledge)
5. Avoid questions that could become outdated quickly (e.g., "current" standings in an ongoing season)
6. For SA-specific questions, include a mix of historical and modern content
7. Each question should be self-contained — no "which of the following" that requires external context
8. Options should be similar in format and length (don't make the correct answer obviously different)

RESPOND ONLY WITH A JSON ARRAY. No markdown, no explanation, just the JSON array.

Each question object must have exactly these fields:
{
  "question": "The question text",
  "option_a": "First option",
  "option_b": "Second option", 
  "option_c": "Third option",
  "option_d": "Fourth option",
  "correct_answer": 0-3 (index of correct option, 0=A, 1=B, 2=C, 3=D),
  "category": "Exact category name",
  "difficulty": "easy|medium|hard",
  "ai_confidence": 0.0-1.0 (your confidence in factual accuracy)
}`;

async function generate(count = 21, categoryFilter = null) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build category distribution
  let categories = [...CATEGORIES.sa, ...CATEGORIES.global];
  if (categoryFilter) {
    categories = categories.filter((c) => categoryFilter.includes(c.name));
  }

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const distribution = categories.map((c) => ({
    ...c,
    target: Math.max(1, Math.round((c.weight / totalWeight) * count)),
  }));

  // Adjust to hit exact count
  let total = distribution.reduce((sum, c) => sum + c.target, 0);
  while (total > count) {
    const max = distribution.reduce((a, b) => (a.target > b.target ? a : b));
    max.target--;
    total--;
  }
  while (total < count) {
    const min = distribution.reduce((a, b) => (a.target < b.target ? a : b));
    min.target++;
    total++;
  }

  console.log("\n🤖 Generating questions with distribution:");
  distribution.forEach((c) => console.log(`   ${c.name}: ${c.target} questions`));

  const allQuestions = [];

  // Generate in batches per category for better quality
  for (const cat of distribution) {
    if (cat.target === 0) continue;

    console.log(`\n📝 Generating ${cat.target} ${cat.name} questions...`);

    const userPrompt = `Generate exactly ${cat.target} sports trivia questions for the category "${cat.name}".

Context for this category: ${cat.context}

Difficulty mix: roughly 30% easy, 50% medium, 20% hard.
Category field must be exactly: "${cat.name}"

Remember: respond with ONLY a JSON array, no other text.`;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content[0].text.trim();
      // Clean potential markdown fences
      const clean = text.replace(/```json\s*|```\s*/g, "").trim();
      const questions = JSON.parse(clean);

      // Validate each question
      const validated = questions.filter((q) => validateQuestion(q, cat.name));
      allQuestions.push(...validated);

      console.log(`   ✅ Generated ${validated.length}/${cat.target} valid questions`);
    } catch (err) {
      console.error(`   ❌ Failed for ${cat.name}: ${err.message}`);
    }

    // Small delay between API calls
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n🎉 Total generated: ${allQuestions.length}/${count} questions`);
  return allQuestions;
}

function validateQuestion(q, expectedCategory) {
  // Check required fields
  const required = ["question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "category", "difficulty"];
  for (const field of required) {
    if (q[field] === undefined || q[field] === null || q[field] === "") {
      console.warn(`   ⚠️ Missing field: ${field}`);
      return false;
    }
  }

  // Validate correct_answer range
  if (q.correct_answer < 0 || q.correct_answer > 3) {
    console.warn(`   ⚠️ Invalid correct_answer: ${q.correct_answer}`);
    return false;
  }

  // Validate difficulty
  if (!["easy", "medium", "hard"].includes(q.difficulty)) {
    q.difficulty = "medium"; // Default
  }

  // Validate category matches
  if (q.category !== expectedCategory) {
    q.category = expectedCategory; // Fix it
  }

  // Check for duplicate options
  const options = [q.option_a, q.option_b, q.option_c, q.option_d];
  if (new Set(options).size !== 4) {
    console.warn(`   ⚠️ Duplicate options detected`);
    return false;
  }

  // Check question length
  if (q.question.length < 10 || q.question.length > 300) {
    console.warn(`   ⚠️ Question length out of range: ${q.question.length}`);
    return false;
  }

  // Set confidence if missing
  if (!q.ai_confidence) q.ai_confidence = 0.8;

  // Set source
  q.source = "ai_generated";
  q.status = "pending"; // Always pending — needs human review

  return true;
}

// ═══════════════════════════════════════
// CLI EXECUTION
// ═══════════════════════════════════════

if (require.main === module) {
  const count = parseInt(process.argv[2]) || 21;
  const categories = process.argv[3] ? process.argv[3].split(",") : null;

  generate(count, categories)
    .then((questions) => {
      if (questions.length > 0) {
        // Save to database
        const db = require("../backend/database");
        db.setupDatabase();
        const ids = db.questions.createBatch(questions);
        console.log(`\n💾 Saved ${ids.length} questions to database`);
        console.log("   Review them in the admin CMS at /admin");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

module.exports = { generate, validateQuestion };
