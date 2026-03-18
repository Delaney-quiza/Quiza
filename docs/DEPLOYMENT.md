# SportQ — Deployment & Operations Guide

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env with your values

# 3. Setup database + seed questions
npm run db:seed

# 4. Start both servers
npm run dev
```

- Quiz app: http://localhost:5173
- Admin CMS: http://localhost:5173/admin
- API: http://localhost:3001/api

Default admin login:
- Email: admin@sportq.app
- Password: (set in .env ADMIN_PASSWORD)

---

## Production Deployment

### Option A: Vercel + Railway (Recommended)

**Frontend → Vercel**
```bash
cd frontend
npx vercel --prod
```
Set env var: `VITE_API_URL=https://your-railway-api.up.railway.app`

**Backend → Railway**
```bash
railway login
railway init
railway up
```
Set env vars in Railway dashboard:
- `DATABASE_URL` → PostgreSQL connection string (Railway provides this)
- `JWT_SECRET` → random 64-char string
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `ANTHROPIC_API_KEY` → your Claude API key
- `FRONTEND_URL` → your Vercel domain
- `NODE_ENV=production`

### Option B: Single VPS (DigitalOcean/Hetzner)

```bash
# On server
git clone your-repo
cd sportq
npm install --production
npm run build
npm run db:seed
pm2 start backend/server.js --name sportq-api
pm2 start scripts/cron-scheduler.js --name sportq-cron
```

Use nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name sportq.app;

    location /api {
        proxy_pass http://localhost:3001;
    }

    location / {
        root /path/to/sportq/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Daily Operations

### Content Pipeline (Weekly Cadence)

**Monday** — AI generates 21 candidate questions
```bash
npm run generate           # Or trigger from admin CMS
```

**Monday–Wednesday** — Review queue in admin CMS
- Login at /admin
- Go to "Review Queue" tab
- Approve, edit, or reject each AI-generated question
- Add manual topical questions (e.g. weekend results)

**Wednesday** — Schedule upcoming week
- Go to "Schedule" tab
- Click "Auto-Schedule Next 7 Days"
- Review category mix per day
- Adjust manually if needed

### Monitoring Checklist
- [ ] Question buffer > 30 approved questions
- [ ] Next 7 days all scheduled
- [ ] Daily player counts stable/growing
- [ ] No error batches in generation history

---

## Database Management

### Backup (SQLite)
```bash
cp sportq.db sportq-backup-$(date +%Y%m%d).db
```

### Migration to PostgreSQL
When scaling beyond ~10K daily players, migrate from SQLite:
1. Provision PostgreSQL (Railway, Supabase, or Neon)
2. Update `DATABASE_URL` in .env
3. The app auto-detects PostgreSQL and adjusts queries
4. Run `npm run db:setup` to create tables
5. Migrate data with pg_dump/restore

---

## API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| Quiz submit | 3 requests | 1 minute |
| AI generate | 5 requests | 1 hour |

---

## Scaling Considerations

**1K DAU** — SQLite + single server is fine
**10K DAU** — Move to PostgreSQL, add Redis for caching
**100K DAU** — Add CDN (Cloudflare), horizontal API scaling
**1M DAU** — Dedicated DB cluster, queue system for submissions
