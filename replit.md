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

- `artifacts/askhealth/` — Main React frontend (previewPath: `/`). Installable PWA — `manifest.json`, service worker (`/sw.js`), icons (`/icon.svg`, `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`), offline fallback (`/offline.html`). Install button in `src/components/PWAInstallButton.tsx` uses `beforeinstallprompt` for Chromium and shows iOS Add-to-Home-Screen instructions for Safari. SW registers only in `import.meta.env.PROD` to avoid intercepting the workspace dev iframe.
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

## User Roles

| Role | Access |
|------|--------|
| `member` | Communities, posts, comments, appointments, chat |
| `moderator` | Member + admin panel access |
| `medical_professional` | Member + Medical Pro Portal (AI validation, expert responses). See `/medpro` |
| `admin` | Full GODMODE — all above + user management, community control, post moderation, credits |

Admin promotes users via the GODMODE dashboard Users tab. Medical pros are verified via "Verify Professional" button.

## Database Schema

### Core
- `users` — Clerk-linked profiles, roles (`admin/moderator/medical_professional/member`), gamification (health_credits, level), `specialty`, `registrationNumber`, `isVerifiedPro`, `username` (unique), `mobileNumber` (unique)
- `communities`, `community_members`, `posts` (`isModerated`, `isExpertAnswered` flags), `post_upvotes`, `comments`, `achievements`
- `consents` — user consent records (post_health_data, ai_assistance)
- `ai_summaries` — per-post AI summaries with validation workflow (`status`: pending/approved/rejected/edited, `validatedById`, `editedContent`, `validationNote`)

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
- User management (roles: admin/moderator/medical_professional/member via `PATCH /api/users/:clerkId/role`, ban/unban)
- Community management (create, archive)
- Broadcast tool (post to all/selected communities)
- Provider rankings management (`GET/POST /admin/rankings`)
- API: `GET /admin/appointments` — all appointments

### 8. Doctor Consultation System
- `lib/db/src/schema/consultations.ts` — `doctorConsultationsTable` schema
- Fields: userId, postId (nullable), chatSessionId (nullable), riskLevel, reason, status (pending/in_review/resolved), source (user_request/ai_flag/auto_high_risk), doctorNote, resolvedById, resolvedAt
- **"Get a Doctor's Opinion" button** appears on post detail pages (high/emergency AI risk) and chat (high/emergency AI response)
- **MedPro Portal** (`/medpro`): "Urgent Cases" tab (high/emergency risk AI summaries), "Patient Requests" tab (user-requested consultations with resolve modal)
- API routes: `GET /api/medpro/urgent-cases`, `GET /api/medpro/consultations`, `PATCH /api/medpro/consultations/:id/resolve`, `POST /api/posts/:id/request-consultation`, `POST /api/chat/sessions/:id/request-consultation`

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
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Yukti AI primary (claude-haiku-4-5, fast)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Yukti AI fallback (gpt-4o-mini, vision)
- `DATABASE_URL`, `PGHOST`, `PGPORT`, etc. — PostgreSQL
- `SESSION_SECRET` — Session

## Safety, Compliance & Multi-Language (Apr 2026 hardening)
- **Unified AI client** (`lib/aiClient.ts`): Anthropic claude-haiku-4-5 primary (≈1–2s) with OpenAI gpt-4o-mini fallback. Image attachments auto-route to OpenAI (Anthropic vision needs base64). 8s default timeout per provider.
- **Multi-language detection** (`lib/languageDetect.ts`): 12 languages — en, hi (Devanagari), hi-Latn (Hinglish via lexicon), bn, ta, te, mr, gu, pa, kn, ml, ur. Yukti replies in user's script. Voice input also picks per-user BCP47 locale.
- **Emergency hard-stop** (`lib/emergencyDetect.ts` + chat.ts + searchEngine.ts): Multi-language triggers (chest pain, suicide, breathing distress, severe bleeding) short-circuit BEFORE the AI in BOTH chat and search. Returns 108/AASRA/poison-control numbers in 0–2 ms. No AI cost, no latency, no soft answers.
- **Rate limiting** (`lib/rateLimiter.ts`, IPv6-safe): /api/chat, /api/ai, /api/health-search, /api/admin, /api/auth, plus a baseline /api limiter. Tested: 100 calls → ~28 succeed, 82 throttled (429).
- **DPDP consent**: POST/GET `/api/consents` (already in place).
- **MedPro**: `requireMedPro` middleware + dashboard endpoints (urgent cases, expert response, queue, stats).
- **Admin hardening**: `requireAdmin` on every /admin/* route — broadcast, stats, communities, posts, AI summaries, credits.
- **External-referral sanitiser** (`healthAssistant.ts` + `searchEngine.ts`): regex strips Practo/1mg/Apollo 24/PharmEasy/Justdial/Lybrate/Netmeds/WebMD/Google/NHP from every AI summary; verified clean across all test queries.
- **Voice + attachments** (`pages/chat.tsx`): browser Web Speech API for transcribed voice input (no audio file upload), image+PDF attachments validated via `/api/uploads/inline` (mime check + 4 MB cap).

## Per-User AI Quota & 3-Month Subscription (Apr 2026)
- **Limits**: 4 AI questions/day, 15/week, 50/month per user (rolling UTC-day windows). Emergencies bypass the quota.
- **Where enforced** (server, `lib/quota.ts`):
  - `POST /api/chat/sessions/:id/messages` — checks quota *after* emergency detection, *before* persisting the user's message; consumes only on successful AI reply.
  - `POST /api/ai/chat` (legacy community AI) — same pattern; consumes after success.
- **Storage**: `api_usage(user_id, day_key YYYY-MM-DD, count)` — one row per user per UTC day, upsert+increment via `ON CONFLICT (user_id, day_key) DO UPDATE`. `users.subscription_expires_at` (timestamptz, nullable) gates bypass.
- **429 response shape**: `{ error: "quota_exceeded", message, quota: { exceeded, used:{daily,weekly,monthly}, limits:{4,15,50}, resetAt } }`. `resetAt` is the next UTC midnight (when the oldest in-window day rolls out).
- **Status endpoint**: `GET /api/users/me/quota` returns the same `quota` shape (used by frontend to refresh after subscription).
- **Subscription** (`POST /api/payments/upi/subscribe`): creates a UPI payment for ₹299 / 90 days (purpose `subscription_3mo`, payee VPA `9278347143@upi`). On `POST /api/payments/upi/confirm` with `payment.purpose === "subscription_3mo"`, calls `activateSubscription(user.id, 90)` which extends `subscription_expires_at` (stacks if user re-pays before expiry). Confirm is idempotent: conditional update `WHERE status='created'` so concurrent confirms don't double-grant.
- **Frontend** (`components/QuotaExhaustedModal.tsx`, mounted in `pages/chat.tsx`): on a 429 from send-message, the modal shows current usage, the limit hit, the reset time, and a CTA "Subscribe to three month plan" → opens the existing UPI flow (link / copy UPI ID + reference / paste UTR). On confirm, modal closes and quota query is invalidated.
- **Known limitation (pre-existing)**: UPI confirm trusts the user-supplied UTR (no provider verification yet). Same trust model as the existing community-premium flow; should be replaced with a provider webhook before scaling.

## In-App Content System (Apr 2026)
Admins can attach a YouTube video, web article (in-app webview), or audio episode to a broadcast post. Members watch/read/listen inside the app and tap "Ask Yukti about this" to deep-link into the chat with a pre-filled prompt + community context.
- Posts table extended with 6 columns: `contentType` (NOT NULL DEFAULT 'discussion'), `contentUrl`, `contentSource`, `contentThumbnail`, `contentDurationSec`, `contentSummary` (all other 5 nullable).
- Backend: `POST /api/admin/content/summarize` (admin-gated; uses aiChat) generates a 2-3 sentence editorial summary; `POST /api/admin/broadcast` accepts the same content fields and persists them via `lib/contentMeta.ts` (`normaliseContentFields`, `extractYouTubeId`, `deriveYouTubeThumbnail`, `buildYouTubeEmbedUrl`, `detectContentSource`).
- Frontend: `<ContentEmbed>` (YouTube nocookie iframe with lazy thumbnail-first activation, HTML5 audio, sandboxed article webview Dialog) + a gradient "Ask Yukti about this" CTA → `/chat?prompt=...&community=<slug>&communityName=<name>`.
- `/chat` reads `?prompt=` once, prefills the input, focuses it, and `history.replaceState` strips the param so refresh doesn't re-prefill.
- `/broadcast` UI: a Tabs row (Discussion/Video/Article/Audio); the legacy "discussion" path is the default and renders unchanged.
- Strictly additive — when `contentType` is 'discussion' OR `contentUrl` is null, PostCard renders the legacy discussion view exactly as before.

## Auth — Sign-in/Sign-up (Clerk Prebuilt Components)
- `pages/sign-in.tsx` and `pages/sign-up.tsx` are thin brand wrappers around Clerk's hosted `<SignIn />` and `<SignUp />` from `@clerk/react` v6. We swapped out a hand-rolled future-API flow because the custom OTP/resend/session paths were brittle (`signIn.create({password})` silently dropped the password, resend cooldown was unreliable, OTP delivery edge cases were leaking errors).
- Wouter routes use wildcards (`/sign-in/*?`, `/sign-up/*?`) so Clerk sub-routes (factor-one, factor-two, verify-email-address, reset-password) resolve under the page. Pages pass `path={`${basePath}/sign-in`}` + `routing="path"` + `forceRedirectUrl={`${basePath}/communities`}`. ClerkProvider in `App.tsx` wires `routerPush`/`routerReplace` (using `stripBase` before `setLocation`) and the brand `appearance`.
- `/sso-callback` route remains for any external OAuth callback that lands outside the sign-in subtree.
- Bootstrap admin: backend `requireAdmin` (`api-server/src/lib/auth.ts`) accepts `x-admin-token: $ADMIN_TOKEN` header and auto-promotes the signed-in Clerk user to `role='admin'` on first valid use. Recovery token entry UI is built into `<AdminGate>` in `App.tsx`. Direct DB promotion: `UPDATE users SET role='admin' WHERE clerk_id='user_...'`.

## Public Yukti Demo on Landing Page (Apr 2026)
- **Backend**: `POST /api/public/ask` (no auth) in `routes/publicAi.ts`. Calls `getHealthAssistantResponse` and returns `{ reply, summary, recommendations[≤3], risk_level, emergency }`. Length-validated (3–500 chars). Emergency triggers short-circuit to the fixed 108/AASRA response.
- **Rate limit**: `publicAiRateLimiter` in `middleware/rateLimiter.ts` — 5 req/hour per IP (IPv6-safe key). Wired in `app.ts` on `/api/public` BEFORE the general limiter.
- **Frontend**: `components/LandingYuktiDemo.tsx` mounted in the hero section of `<Landing>` in `App.tsx`. Single input + Ask button + 3 sample chips. After one successful answer the widget swaps to a card showing the question, Yukti's reply with bullet recommendations, an emergency banner if applicable, and a gradient CTA card with "Create free account" → `/sign-up` and "Sign in" → `/sign-in`. Client enforces one question per page-load (`used` state).

## Key Commands
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/db run seed-providers` — Re-seed doctors/hospitals
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client hooks
