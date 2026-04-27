# HealthCircle — Healthcare Super App

## Overview

A full-featured healthcare super app combining WhatsApp-style AI chat, a doctor/hospital provider network, appointment booking, a clinical community platform, gamification, and an Admin Godmode suite. India-first, multi-language (English + Hindi).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (Node.js backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Clerk (Replit-managed)
- **AI**: OpenAI via Replit AI Integrations (Yukti AI assistant)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild

## Artifacts

- `artifacts/askhealth/` — Main React frontend (previewPath: `/`)
- `artifacts/api-server/` — Express API server (previewPath: `/api`)

## Architecture

```
User (Mobile/Web)
      ↓
Frontend (React Chat UI + Communities + Providers)
      ↓
API Gateway (Node.js / Express)
      ↓
┌────────────────────────────────────────┐
│  AI Layer: healthAssistant.ts          │
│  Search Engine: searchEngine.ts        │
│  Business Logic: routes/*              │
└────────────────────────────────────────┘
      ↓
Database (PostgreSQL via Drizzle ORM)
```

## Database Schema

### Core
- `users` — Clerk-linked profiles, roles, gamification (health_credits, level)
- `communities`, `community_members`, `posts` (viewCount added), `post_upvotes`, `comments`, `achievements`
- `consents` — user consent records (post_health_data, ai_assistance)
- `ai_summaries` — per-post AI summaries (whatItCouldBe, riskLevel, whatToDo, whenToSeeDoctor, disclaimer)

### Health Super App
- `doctors` — specialist profiles (specialty, fee, rating, location, languages, available)
- `hospitals` — facility records with specialties array, ratings, contact info
- `appointments` — patient-doctor-hospital bookings with status (booked/completed/cancelled)
- `health_chat_sessions` — per-user Yukti AI chat sessions (persisted, titled)
- `health_chat_messages` — messages with intent, structured_response JSONB, language

### Analytics & Admin
- `search_logs` — query analytics (userId, query, intent, language)
- `provider_rankings` — admin boost scores for search ranking
- `audit_logs` — compliance trail (action, performed_by, metadata JSONB)

### Legacy
- `conversations`, `messages` — original generic chat tables (kept for compat)

## Key Features

### 1. WhatsApp-style AI Chat (`/chat`)
- Persistent chat sessions saved to DB per user
- Yukti AI responds with structured JSON: intent, risk_level, summary, recommendations, disclaimer
- Intent classification: symptom / treatment / doctor / lab / general / emergency
- Risk badges: low (green) / medium (amber) / high / emergency (red)
- Suggested follow-up questions per response
- Multi-language: auto-detects Hindi (Devanagari script detection)
- Voice + file attach UI (mock, ready for backend integration)
- Sidebar with session history, session deletion, titling from first message

### 2. Health Search Engine (`GET /api/health-search?q=`)
- Intent classifier (symptom/treatment/doctor/lab/general keywords + Hindi)
- Risk assessment
- Returns: intent, summary, risk_level, recommendations, providers (DB), articles (curated)
- Logs queries to search_logs table for analytics

### 3. Provider System
- `/providers` — Browse 8 doctors + 6 hospitals (seeded)
- Filter by specialty, location, availability, name
- Doctor cards: rating, experience, fee, languages, availability badge
- Hospital cards: specialties, rating, phone, website
- Book appointments via modal (date + time picker)
- `/appointments` — My upcoming/past appointments, cancel functionality

### 4. AI Medical Response Engine
- `artifacts/api-server/src/lib/healthAssistant.ts`
- Structured JSON prompting with response_format: json_object
- Evidence-based tone, no hallucinations, always includes disclaimer
- Last 10 messages of history sent for context
- Graceful fallback on parse errors

### 5. Clinical Communities (`/communities`)
- Community feed with posts, pinning, upvotes, comments
- Yukti AI sidebar in each community
- Community-specific gamification leaderboard

### 6. Gamification
- Health Credits: +10 post, +5 comment, +2 upvote received
- Levels 1-10: Newcomer → Health Pioneer
- Badges at credit milestones
- Weekly & all-time leaderboards

### 7. Admin Godmode (`/admin`)
- Platform stats dashboard
- User management (roles, ban/unban)
- Community management (create, archive)
- Broadcast tool (post to all/selected communities)
- Provider rankings management (`GET/POST /admin/rankings`)
- API: `GET /admin/appointments` — all appointments

## Key Routes

### Frontend
- `/` — Landing page (→ /chat if signed in)
- `/chat` — WhatsApp-style Yukti AI chat (PRIMARY)
- `/providers` — Browse doctors & hospitals, book appointments
- `/appointments` — My appointments
- `/communities` — Community hub
- `/communities/:id` — Community feed
- `/communities/:id/post/:id` — Post detail
- `/search` — Global search
- `/profile` — User profile & gamification
- `/admin` — Admin dashboard (admin only)
- `/admin/broadcast` — Broadcast tool (admin only)

### API
- `GET /api/healthz` — Health check
- `GET/POST /api/chat/sessions` — Chat session CRUD
- `GET/POST /api/chat/sessions/:id/messages` — Chat messages
- `DELETE /api/chat/sessions/:id` — Delete session
- `GET /api/doctors` — List/filter doctors
- `GET /api/hospitals` — List/filter hospitals
- `POST /api/appointments` — Book appointment
- `GET /api/appointments` — My appointments
- `PATCH /api/appointments/:id/cancel` — Cancel appointment
- `GET /api/health-search?q=` — Health search engine
- `POST /api/ai/chat` — Legacy community AI chat
- `GET /api/admin/stats` — Admin stats
- `POST /api/admin/broadcast` — Broadcast posts

## Environment Variables
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Auth
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Yukti AI
- `DATABASE_URL`, `PGHOST`, `PGPORT`, etc. — PostgreSQL
- `SESSION_SECRET` — Session

## Key Commands
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/db run seed-providers` — Re-seed doctors/hospitals
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client hooks
