# Back Office Insights — Phase 1 Foundation

This package contains the complete Phase 1 foundation for the V1 portal:

- Next.js + TypeScript + Tailwind
- Local PostgreSQL via Docker
- Prisma connection
- Single-user login with NextAuth Credentials
- Protected routes
- Main navigation
- Placeholder V1 sections:
  - Today
  - Surface Testing
  - Collections Performance
  - Outputs

## 1. Requirements

Install:

- Node.js 20+
- npm
- Docker Desktop

## 2. Create your environment file

Copy:

```bash
cp .env.example .env
```

Then edit `.env`:

- `NEXTAUTH_SECRET` — use a long random string
- `ADMIN_EMAIL` — your login email
- `ADMIN_PASSWORD` — your local login password

## 3. Start PostgreSQL

```bash
docker compose up -d
```

## 4. Install dependencies

```bash
npm install
```

## 5. Generate Prisma client

```bash
npx prisma generate
```

## 6. Create the first database migration

```bash
npx prisma migrate dev --name init
```

## 7. Start the portal

```bash
npm run dev
```

Open:

http://localhost:3000

You should be redirected to `/login`.

Sign in with the values from:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## 8. Phase 1 verification

Confirm:

- Login works.
- Wrong credentials are rejected.
- `/today` loads.
- `/surface-testing` loads.
- `/collections` loads.
- `/outputs` loads.
- Navigation works.
- Sign out works.
- PostgreSQL container is running.
- `npx prisma studio` opens successfully.

## 9. What is intentionally NOT included yet

Phase 1 does not include:

- Lite/App/Portal check execution
- Metabase upload
- Pandas calculations
- Collections dashboards
- Daily/weekly generation
- AI
- Deployment configuration

Those are later phases.

## 10. Suggested first Git commit

```bash
git init
git add .
git commit -m "Phase 1 foundation"
```
# backoffice-insights-portal
