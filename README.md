# Vx Weekly Client Health Prototype

Prototype application for the Vx Group build challenge.  
Goal: replace spreadsheet-based weekly client health scoring with a fast, usable workflow for Coaches and leadership.

## What It Does

- View a list of client accounts with risk labels
- Enter weekly `Current` and `Predictive` scores (1-5)
- Require action planning when predictive score is below 5
- Capture notes for delivery context
- View score history by client
- Leadership risk panel sorted by highest risk first
- AI-assisted action suggestions (OpenAI if key exists, fallback heuristics if not)

## Tech Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Supabase (Postgres + API persistence)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Setup (Required)

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor.
3. Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional, only needed if you want server-role access:
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_key_here
```

Notes:

- `OPENAI_API_KEY` is optional (fallback suggestions still work).
- You can use one Supabase project/config for both local and Vercel.
- On first API load, the app auto-seeds Supabase from `src/lib/seed-data.ts` if `clients` is empty.

## Assumptions

- One score entry per client per week
- Week starts on Monday for this prototype
- No user authentication flow in prototype scope (RLS is enabled with prototype policies)
- Seed data reflects representative client patterns from the sample spreadsheet

## Intentionally Left Out

- Multi-user sync and real-time collaboration
- Role-based access control
- Production-grade secrets management and audit logging
- Notification workflows (Slack/email)
- Data import UI for spreadsheet uploads

## What I Would Build Next

- Coach/leadership role separation
- Trend charts and portfolio-level alerts
- Weekly digest generation (AI summary + top risks + recommended interventions)
- Automated anomaly/risk detection from score trajectories
