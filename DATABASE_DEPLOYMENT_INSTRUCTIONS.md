# Database Deployment Quick Guide

## Prerequisites

- PostgreSQL database (Neon serverless)
- Node.js 18+
- Git repository up to date

## Setup Environment Variables

**bot/.env**:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SIDESHIFT_API_KEY=your_key
TELEGRAM_BOT_TOKEN=your_token
GROQ_API_KEY=your_key
```

**frontend/.env.local**:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXT_PUBLIC_API_URL=http://localhost:3000
FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_domain
```

## Install Dependencies

```bash
# Install bot dependencies first
cd bot
npm install

# Create junction links for shared and frontend (Windows)
cd ../shared
npm install
Remove-Item -Recurse -Force node_modules/drizzle-orm -ErrorAction SilentlyContinue
New-Item -ItemType Junction -Path "node_modules/drizzle-orm" -Target "../bot/node_modules/drizzle-orm"

cd ../frontend
npm install
Remove-Item -Recurse -Force node_modules/drizzle-orm -ErrorAction SilentlyContinue
New-Item -ItemType Junction -Path "node_modules/drizzle-orm" -Target "../bot/node_modules/drizzle-orm"

# For Linux/Mac, use symlinks instead:
# ln -s ../bot/node_modules/drizzle-orm node_modules/drizzle-orm
```

## Apply Database Migrations

```bash
# Generate migration files
cd shared
npm run db:gen

# Apply to database (choose one):
npm run db:push     # Development (direct schema sync)
npm run db:migrate  # Production (tracked migrations)

# Verify with Drizzle Studio
npm run db:studio   # Opens at https://local.drizzle.studio
```

## Build Applications

```bash
# Build bot
cd bot
npm run build

# Build frontend
cd frontend
npm run build
```

## Verify Deployment

```bash
# Test bot
cd bot
npm run dev

# Test frontend (separate terminal)
cd frontend
npm run dev
# Visit: http://localhost:3000/api/rewards/leaderboard
```

## Troubleshooting

**Error: "Cannot find module 'drizzle-orm'"**

```bash
# Recreate junction links (see Install Dependencies above)
```

**Error: TypeScript type conflicts**

```bash
# Ensure all packages use drizzle-orm@0.45.1
npm list drizzle-orm
```

**Error: "relation already exists"**

```bash
# Use db:push for development instead of db:migrate
cd shared
npm run db:push
```

## Rollback (if needed)

```bash
git revert HEAD
git push origin main
npm run build
```
