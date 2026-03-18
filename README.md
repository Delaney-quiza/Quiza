# 🇿🇦 SportQ — Daily Sports Trivia

A free-to-play daily sports quiz app with Wordle-style social sharing, designed for the South African market with global sports appeal.

## Architecture Overview

```
sportq/
├── backend/                 # Express.js API server
│   ├── server.js           # Main server + API routes
│   ├── database.js         # SQLite database setup + queries
│   ├── auth.js             # JWT auth for admin + anonymous player tokens
│   └── middleware.js       # Rate limiting, CORS, error handling
│
├── scripts/
│   ├── generate-questions.js   # AI question generation pipeline (Claude API)
│   ├── seed-database.js        # Initial question bank seeder
│   └── cron-scheduler.js       # Daily cron job for question scheduling
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.jsx              # Router + layout
│       ├── pages/
│       │   ├── Quiz.jsx         # Player-facing daily quiz
│       │   ├── Admin.jsx        # Admin CMS dashboard
│       │   └── Login.jsx        # Admin login
│       ├── components/
│       │   ├── TimerRing.jsx
│       │   ├── QuestionCard.jsx
│       │   ├── ShareCard.jsx
│       │   ├── BadgeDrawer.jsx
│       │   └── StatsBar.jsx
│       └── styles/
│           └── globals.css
│
├── package.json
├── .env.example
└── README.md
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + Vite | Fast builds, excellent DX |
| **Backend** | Express.js | Simple, battle-tested Node.js framework |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Zero-config locally, scales with managed DB |
| **Auth** | JWT tokens | Stateless, works for both admin + anonymous players |
| **AI Pipeline** | Anthropic Claude API | Question generation + validation |
| **Scheduling** | node-cron | Daily question selection + AI batch generation |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) | Free tiers available |

## Setup & Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Anthropic API key (for AI question generation)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/sportq.git
cd sportq
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:
```
DATABASE_URL=./sportq.db
JWT_SECRET=your-secret-key-here
ADMIN_EMAIL=admin@sportq.app
ADMIN_PASSWORD=change-this-password
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 3. Initialize Database & Seed Questions

```bash
npm run db:setup        # Creates tables
npm run db:seed         # Seeds initial 60+ question bank
```

### 4. Start Development

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Or both:
npm run dev
```

### 5. Generate AI Questions (optional)

```bash
npm run generate         # Generate a batch of 21 questions (1 week)
```

## API Endpoints

### Public (Player)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quiz/today` | Get today's 3 questions |
| POST | `/api/quiz/submit` | Submit answers + timings |
| GET | `/api/player/stats` | Get player stats + badges |
| POST | `/api/player/register` | Create anonymous player token |

### Admin (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login → JWT |
| GET | `/api/admin/questions` | List all questions (filterable) |
| POST | `/api/admin/questions` | Create a question |
| PUT | `/api/admin/questions/:id` | Edit a question |
| DELETE | `/api/admin/questions/:id` | Delete a question |
| GET | `/api/admin/schedule` | View scheduled quizzes |
| POST | `/api/admin/schedule` | Schedule questions for a date |
| POST | `/api/admin/generate` | Trigger AI question generation |
| GET | `/api/admin/analytics` | Player stats + engagement metrics |

## Daily Question Pipeline

```
┌─────────────────────┐
│   AI Generation     │  Weekly cron generates 21 candidate questions
│   (Claude API)      │  across SA Rugby, Cricket, PSL, F1, Golf, etc.
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Review Queue      │  Admin CMS shows candidates for human review
│   (Admin CMS)       │  Approve, edit, or reject each question
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Scheduling        │  Approved questions scheduled to specific dates
│   (Calendar View)   │  Ensures mix: 1 SA + 1 Global + 1 Wildcard
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Daily Serve       │  Midnight cron activates today's quiz
│   (API)             │  All players get same 3 questions
└─────────────────────┘
```

## Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel deploy --prod
```

### Backend (Railway)
```bash
railway login
railway up
```

### Environment Variables (Production)
- Set `DATABASE_URL` to your PostgreSQL connection string
- Set `JWT_SECRET` to a strong random string
- Set `ANTHROPIC_API_KEY` for AI generation
- Set `FRONTEND_URL` to your Vercel domain

## Monetisation Roadmap

1. **Free tier** — 3 daily questions, shareable results
2. **Premium** (R29/month) — Bonus round (2 extra questions), detailed stats, ad-free
3. **Sponsorship** — Branded quiz days ("Brought to you by Castle Lager")
4. **B2B** — White-label for sports brands, betting companies, broadcasters

## License

Proprietary — © 2026 SportQ
