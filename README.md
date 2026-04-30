# HealthCircle

India-first AI healthcare super app — clinical communities, AI health chat (Yukti), real WebRTC teleconsult, doctor directory, and appointments in one platform.

---

## What it is

HealthCircle combines:

- **Clinical communities** — condition-specific forums with posts, comments, reactions, upvotes, pinning, and AI-generated expert summaries
- **Yukti AI chat** — a persistent, session-based health assistant (structured intent + risk classification, not freeform text)
- **Live teleconsult** — real browser-to-browser WebRTC video/audio with a signaling server, triage flow, and post-consult prescriptions
- **Provider directory** — doctors and hospitals seeded in the DB, extended by live OpenStreetMap proximity lookup
- **Appointment booking** — creates appointment records (no slot/calendar logic yet)
- **Gamification** — health credits, levels, achievements, and per-community leaderboards
- **Admin console** — full GODMODE: user management, community control, broadcast composer, AI summary moderation, audit log

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS v4 + shadcn/ui, `wouter` routing |
| Backend | Express 5, TypeScript, Node.js 24 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Email + OTP (magic-code), password login, Google ID-token sign-in — `sid` session cookie |
| AI | Anthropic / OpenAI via Replit AI Integrations proxy |
| Email | Resend (degrades to console log without the key) |
| Realtime | Native browser WebRTC + in-process WebSocket signaling |
| API contract | OpenAPI 3.1 → Orval codegen (Zod schemas + React Query hooks) |
| Monorepo | pnpm workspaces |

---

## Repo layout

```
artifacts/
  askhealth/        # React frontend  (preview path: /)
  api-server/       # Express backend (preview path: /api)
  mockup-sandbox/   # Design preview only, not user-facing
lib/
  api-spec/         # openapi.yaml + Orval config
  api-client-react/ # Generated hooks and Zod schemas
  db/               # Drizzle schema shared between packages
scripts/            # Utility scripts
```

---

## Running locally

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Install

```bash
pnpm install
```

### Environment variables

Create a `.env` file in `artifacts/api-server/` (or set these in your environment):

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Signs the `sid` session cookie |
| `ADMIN_TOKEN` | Yes | Server-secret for ops/CI admin bypass |
| `RESEND_API_KEY` | Recommended | Real email delivery for OTPs and resets |
| `GOOGLE_CLIENT_ID` | Recommended | Google sign-in |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | For AI features | Anthropic proxy base URL |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | For AI features | Anthropic proxy key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | For AI features | OpenAI proxy base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | For AI features | OpenAI proxy key |

Without AI env vars, Yukti chat, `@askYukti` replies, triage, and search summaries return a clear "service not configured" error — they never fall back to fake answers.

### Database

```bash
pnpm --filter @workspace/api-server run db:push
```

### Start dev servers

```bash
# Backend (port from $PORT env, default 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (port from $PORT env, default 5173)
pnpm --filter @workspace/askhealth run dev
```

A global reverse proxy routes `/api/*` to the backend and `/` to the frontend — the same setup used in production.

---

## Key routes

| Path | Description | Auth |
|---|---|---|
| `/` | Redirects signed-in users to communities, others to sign-in | No |
| `/sign-in` | Email + OTP / password / Google | No |
| `/communities` | Browse and join communities | Yes |
| `/communities/:id` | Community feed | Yes |
| `/search` | Cross-resource search with AI summary | Yes |
| `/chat` | Yukti AI persistent chat | Yes |
| `/providers` | Doctor and hospital directory | Yes |
| `/appointments` | My appointments | Yes |
| `/teleconsult` | Teleconsult dashboard → triage → video call | Yes |
| `/profile` | Account, credits, achievements | Yes |
| `/medpro` | AI summary review queue | Medical pro only |
| `/admin` | Full admin console | Admin only |
| `/admin/broadcast` | Post to one or all communities at once | Admin only |

---

## User roles

| Role | Access |
|---|---|
| `member` | Communities, posts, chat, appointments, teleconsult |
| `moderator` | Member + post moderation |
| `medical_professional` | Member + MedPro portal (AI summary review, teleconsult prescription) |
| `admin` | Everything — user management, community control, broadcast, credits, audit log |

The first admin is self-elected via `POST /api/admin/bootstrap` (one-shot, only works when no admin exists yet).

---

## PWA

The app ships as an installable PWA: `manifest.json`, a service worker with network-first navigation + asset caching, an offline fallback page, and an install button that adapts to the browser context (one-tap Chrome prompt, manual instructions for Safari/iOS, warning for in-app webviews where install is impossible).

---

## Known gaps (honest)

- **Razorpay not integrated.** Payments today are UPI link + manual admin confirmation. The schema has the `razorpay` provider default but no backend code calls Razorpay's API yet.
- **Premium paywall recorded but not enforced.** `hasPremiumAccess` is set correctly on payment confirm; the post-listing endpoint does not gate content by it yet.
- **Moderated posts still appear in authenticated feeds.** The `isModerated` flag is honored by the public API but not the authenticated community feed.
- **No object storage.** Uploads are inline base64 with a 4 MB cap — not practical for large files.
- **No symptom tracker, personal health records, drug DB, or lab-result upload.**
- **No in-app or push notifications.** Only transactional email (OTP, password reset).
- **Appointment booking has no slot logic** — no availability checks, no conflict detection.

See `HEALTHCIRCLE_FEATURES.md` for the full honest feature inventory with per-item status badges.

---

## License

Private — all rights reserved.
