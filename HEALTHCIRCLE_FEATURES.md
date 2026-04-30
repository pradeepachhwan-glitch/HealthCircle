# HealthCircle — Honest Feature & Flow Reference

A single-page reference for QA, evaluation, and stakeholder review.
Last updated: April 30, 2026.

> **Reading guide.** Every feature below is tagged with a status badge, the **file(s) that prove it**, and a one-line **WHY** if it's not fully active.
> No marketing language. If something is half-built, it says so.

---

## Status Legend

| Badge | Meaning |
|-------|---------|
| ✅ **ACTIVE** | Fully wired end-to-end. Works in this environment today. |
| 🔵 **ENV-DEPENDENT** | Code is real and complete, but only does its job when the right secret/env var is set. Degrades gracefully. |
| 🟡 **PARTIAL** | Works for the common path, but has notable limits or unfinished edges. |
| 🟠 **STUB / METADATA-ONLY** | The route or UI exists, but the underlying behavior is shallow (records data without acting on it, or shows hardcoded copy). |
| ❌ **NOT IMPLEMENTED** | Mentioned in UI, schema, or admin notes — but no working code path. Documented here so it isn't promised. |

---

## 1. Architecture Snapshot

| Layer | Tech |
|---|---|
| Web client | React + Vite + Tailwind, `wouter` for routing |
| Server | Express 5 (TypeScript), session cookie auth (`sid`) |
| Database | PostgreSQL via Drizzle ORM |
| AI | OpenAI-compatible API via Replit AI Integrations proxy (model: `gpt-4o-mini`) |
| Email | Resend (degrades to console logs without `RESEND_API_KEY`) |
| Realtime media | Native browser WebRTC + a custom WebSocket signaling server (in-process) |
| Auth providers | Custom email + 6-digit OTP + Google ID-token sign-in |
| File uploads | Inline base64 data URLs, ~4 MB cap (no object storage) |

The repo is a pnpm monorepo. Three artifacts run as separate workflows:
`api-server` (backend), `askhealth` (the web app), `mockup-sandbox` (design preview only — not user-facing).

---

## 2. Pages & Routes (what the user can navigate to)

Every entry below is a real `<Route>` registered in `artifacts/askhealth/src/App.tsx`.

| Path | Page | Auth required? | Status |
|---|---|---|---|
| `/` | Smart redirect (`HomeRedirect`) — sends signed-in users to communities, others to `/sign-in` | No | ✅ |
| `/sign-in/*?` | Sign in / sign up with email+OTP, magic code, or Google | No | ✅ |
| `/solutions`, `/for-doctors`, `/about`, `/support` | Marketing/info pages | No | ✅ |
| `/terms`, `/privacy` | Legal pages | No | ✅ |
| `/communities` | Browse and join communities | Yes | ✅ |
| `/communities/:id` | Single community feed | Yes | ✅ |
| `/communities/:id/post/:postId` | Single post + comments | Yes | ✅ |
| `/search` | Cross-resource search (posts, communities, providers, AI summary) | Yes | ✅ |
| `/profile` | Your account, posts, communities, achievements | Yes | ✅ |
| `/chat` | Yukti AI chat with persistent sessions | Yes | 🔵 (needs AI env) |
| `/providers` | Doctor & hospital directory (DB + live OpenStreetMap lookup) | Yes | ✅ |
| `/appointments` | Book / list / cancel basic appointments | Yes | 🟡 (no slot logic) |
| `/medpro` | Medical-pro queue: review and approve AI summaries on posts | Yes (medpro role) | ✅ |
| `/become-a-doctor` | Apply to become a verified doctor | Yes | ✅ |
| `/teleconsult` | Teleconsult dashboard | Yes | ✅ |
| `/teleconsult/triage` | AI symptom triage before consultation | Yes | 🔵 (AI env) |
| `/teleconsult/doctors` | Pick a doctor to consult | Yes | ✅ |
| `/teleconsult/session/:id` | Live video / audio / chat consultation room (real WebRTC) | Yes | ✅ |
| `/teleconsult/summary/:id` | Post-consult summary + prescription | Yes | ✅ |
| `/admin` | Full admin console | Yes (admin role) | ✅ |
| `/admin/broadcast` | Push a broadcast post into one or many communities | Yes (admin role) | ✅ |

---

## 3. End-User Flow (step-by-step)

1. **Land** on `/` while signed out → redirected to `/sign-in`. Marketing pages (`/about`, `/solutions`, etc.) are accessible without an account.
2. **Sign up** by entering an email. The server emails a 6-digit OTP via Resend. Enter the OTP to verify the email and create the session cookie. (No password is required for the OTP flow.) Google sign-in is also offered — the server validates the Google ID token, requires `email_verified=true`, and creates / links the account.
3. **First-run onboarding** is implicit: a session is created and the user is redirected to `/communities`.
4. **Browse communities.** The user sees a list of communities (slug, name, description, member count). They can join.
5. **Read a feed.** Inside a community, posts are listed (pinned first, then by recency). Each post shows reactions, upvote count, comment count, the author's level, and whether it's an "expert-answered" post.
6. **Create a post.** Pick a content type (text, link, image, audio, video, article). Posts can mention `@askYukti` — the AI bot will auto-comment with a draft answer.
7. **React, upvote, comment, bookmark.** All four are real DB writes. Reactions support multiple emoji types and show aggregated counts. Receiving an upvote earns the author credits.
8. **Earn credits and level up.** Starting a discussion, receiving upvotes, and receiving reactions all award credits via `awardCredits(...)`. Credits roll up into a level visible on the profile and on the community leaderboard.
9. **Search.** Type a query — the server returns blended results: posts, communities, providers, plus an AI-generated short summary (when AI env is configured).
10. **Ask Yukti directly.** From `/chat`, the user gets a persistent multi-session chat with the AI assistant. Each session is saved to the DB.
11. **Book a doctor.** From `/providers` they can browse a real provider directory (database rows + live OpenStreetMap fallback for nearby clinics). From `/appointments` they can create a basic appointment row tied to a doctor or hospital.
12. **Teleconsult.** Start a triage in `/teleconsult/triage` (AI asks structured symptom questions), book a consultation in `/teleconsult/doctors`, then join `/teleconsult/session/:id`. The session uses **real browser WebRTC** with a server-side WebSocket signaling room.
13. **Become a doctor.** Submit an application from `/become-a-doctor`. Once an admin approves, the user's role flips to `medical_professional` and a `doctors` row is created. They then have access to `/medpro`.
14. **Pay for premium.** A "Premium community" or "3-month subscription" purchase creates a UPI payment record. The user pays via UPI link → admin marks it `paid` → `hasPremiumAccess=true` is recorded. (See payment caveats in §6.)
15. **Install as an app.** The site is a real PWA: there's a manifest, an offline page, and a service worker that precaches assets. The "Install" button appears when the browser allows it.

---

## 4. Admin Flow (step-by-step)

1. **Bootstrap.** The very first user can self-elect to admin via `POST /admin/bootstrap` (one-shot, no admin yet must exist). After that, only existing admins can grant the role.
2. **Stats dashboard.** `/admin` opens a dashboard with: total users, posts, AI summaries, DAU/WAU/MAU, credits issued, role breakdown.
3. **Manage users.** List all users; verify a user as a "Pro"; change a user's role (`user`, `moderator`, `medical_professional`, `admin`).
4. **Manage communities.** Create / edit / archive communities. Toggle premium price. **Toggle "Allow non-members to read posts"** (the new switch from this session — controls public read API access).
5. **Add / remove community members manually** by clerk-id or email.
6. **Moderate posts.** Pin/unpin, mark as moderated/hidden, mark as broadcast, or delete. (See §7 for the visibility caveat.)
7. **Approve AI summaries.** AI-generated post summaries land in a moderation queue. Admins (or `medpro` users) can edit and approve them — approval flips the post's `isExpertAnswered=true` flag.
8. **Send a broadcast.** From `/admin/broadcast`, post a message into one or more communities at once with the `isBroadcast=true` flag.
9. **Award credits.** Manually grant credits to a user (event-logged for audit).
10. **Approve doctor applications.** Inside one transaction: promote the user to `medical_professional`, create a `doctors` row, mark the application approved.
11. **Oversee teleconsult.** List all consultations, view stats, patch consultation status.
12. **Audit log.** Every admin write action is recorded in the audit log, viewable in the admin console.

---

## 5. Feature Inventory (with WHY for non-active items)

### 5.1 Authentication & Accounts

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Email + 6-digit OTP signup | ✅ | `routes/auth.ts`, `lib/auth.ts` | Real DB-backed OTP issuance and consumption |
| Email + password login | ✅ | `routes/auth.ts` | Hashed passwords, session cookie |
| Magic-code passwordless login | ✅ | `routes/auth.ts` | `/auth/request-otp` + `/auth/verify-otp` |
| Google sign-in | 🔵 | `routes/auth.ts` (`/auth/google`) | Verifies Google ID token. Needs `GOOGLE_CLIENT_ID` (set). |
| Password reset by email | ✅ | `routes/auth.ts` | Token-based, time-limited |
| Email verification flow | 🔵 | `routes/auth.ts` | Sends real email when `RESEND_API_KEY` present (set), otherwise logs to console |
| Server sessions (`sid` cookie) | ✅ | `lib/auth.ts` | httpOnly, server-side session row |
| Role guards (`user`, `moderator`, `medical_professional`, `admin`) | ✅ | `lib/auth.ts` (`requireAdmin`, `requireMedPro`, `requireModeratorOrAdmin`) | Enforced on every protected route |
| Admin token bypass for ops (`x-admin-token`) | ✅ | `lib/auth.ts` | Uses `ADMIN_TOKEN` env (set). Used for scripts and CI. |
| Push notifications | ❌ | — | No FCM / web-push code exists. Could be added; not implemented today. |

### 5.2 Communities & Posts

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Create / browse / archive communities | ✅ | `routes/communities.ts` | |
| Join / leave communities | ✅ | `routes/communities.ts` | |
| Posts (text, link, image, audio, video, article) | ✅ | `routes/posts.ts` | Content types stored as `contentType` |
| Comments (CRUD) | ✅ | `routes/comments.ts` | GET / POST / DELETE |
| Reactions (multiple emoji types) | ✅ | `routes/posts.ts` | `summarizeReactionsForPosts` aggregates |
| Upvotes | ✅ | `routes/posts.ts` | Earns credits for the author |
| Bookmarks | ✅ | `routes/posts.ts` | `/me/bookmarks` lists them |
| Pin / unpin posts | ✅ | `routes/posts.ts` (mod-only) | Pinned posts surface first in feeds |
| Broadcast posts | ✅ | `routes/admin.ts` | Admin-only insertion path |
| AI-generated post summaries | 🔵 | `lib/aiSummary.ts`, `routes/posts.ts` | Generated when AI env is set; queued and pollable. Emergency-keyword posts get a deterministic emergency summary (not AI). |
| "Expert answered" badge | ✅ | `routes/medpro.ts` | Set true when a medpro / admin approves an AI summary |
| `@askYukti` auto-reply | 🔵 | `lib/yuktiReply.ts` | Detects `@askYukti` in posts/comments and inserts a bot reply via OpenAI. Needs AI env. |
| Public read-only API for opted-in communities | ✅ | `routes/publicCommunities.ts` | New in this session. Filters out moderated posts. Omits author identifiers. |
| **Hide moderated posts in the *authed* feed** | 🟠 | `routes/posts.ts`, `routes/communities.ts` | Admin can set `isModerated=true`, but the authed feed does **not** filter them out today. Only the public endpoints (added this session) honor it. **Why:** historical — flagging was added before enforcement. Quick to fix when needed. |

### 5.3 AI (Yukti)

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Authed Yukti chat sessions | 🔵 | `routes/chat.ts`, `routes/ai.ts` | Persistent multi-session chat with `gpt-4o-mini`. Needs `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`. |
| Public demo Q&A | 🔵 | `routes/publicAi.ts` (`/api/public/ask`) | Same provider. **Hard rate-limited to 5 requests / hour / IP.** Emergency-keyword inputs return a hardcoded safety message instead of calling AI. |
| AI symptom triage (teleconsult) | 🔵 | `routes/teleconsult.ts` | Returns structured JSON; falls back to a deterministic template if AI unavailable. |
| AI search summary | 🔵 | `lib/searchEngine.ts` | Adds a top-line synthesis to search results. Falls back to template summary if AI fails. |
| AI rate limiting | ✅ | `middleware/rateLimiter.ts` | Authed AI = 30 req / 15 min / user. Public = 5 req / hour / IP. |
| Mock / canned AI responses | ❌ | — | Intentional. If the AI provider is unconfigured, endpoints return a clear "service not configured" error instead of fake text. |

### 5.4 Doctor & Provider Features

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Doctor & hospital directory | ✅ | `routes/providers.ts`, `lib/osmProviders.ts` | DB rows + live OpenStreetMap lookup for proximity |
| Doctor application & admin approval | ✅ | `routes/doctorApplications.ts` | End-to-end with role promotion in a single transaction |
| MedPro AI-summary review queue | ✅ | `routes/medpro.ts` | Reviewers can edit and approve summaries; flips `isExpertAnswered` |
| Appointment booking | 🟡 | `routes/appointments.ts` | Creates an appointment row with a chosen time. **No slot availability, no double-booking checks, no calendar sync.** Why: scoped as MVP — useful for record-keeping but not a real scheduler yet. |
| Doctor verification badge | ✅ | `routes/admin.ts` (`/admin/users/:id/verify-pro`) | Admin-toggled |

### 5.5 Teleconsult (the live consultation product)

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Triage session creation (AI-driven) | 🔵 | `routes/teleconsult.ts` | |
| Consultation booking (video / audio / chat) | ✅ | `routes/teleconsult.ts` | DB rows for `tcConsultations` |
| **Real WebRTC video / audio call** | ✅ | `lib/teleconsultSignaling.ts` (server WebSocket signaling), `hooks/useTeleconsultCall.ts` (browser `RTCPeerConnection` + `getUserMedia`) | Native browser-to-browser media. Server only relays signaling — no media goes through the server. Room is gated by user identity and consultation membership. |
| In-call text messaging | 🟡 | `routes/teleconsult.ts` (`/tc/message`) | Patient-side write is implemented; **doctor-side write endpoint is not yet wired**. Why: in-call relay happens via the WebSocket peer channel; persisted doctor messages were not in MVP scope. |
| Doctor prescription generation | ✅ | `routes/teleconsult.ts` (`/tc/prescription/generate`) | Stored as structured JSON on `tcPrescriptions`. Visible on the post-consult summary. |
| Consultation start / close / complete states | ✅ | `routes/teleconsult.ts` | Status machine recorded in DB |
| Admin teleconsult oversight | ✅ | `routes/admin.ts` | Lists, stats, and per-consult patches |

### 5.6 Payments

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| UPI manual payment flow | ✅ | `routes/payments.ts` | `/payments/upi/config`, `/initiate`, `/confirm`. Records a `payments` row. |
| Premium community membership tracking | 🟡 | `routes/payments.ts`, `routes/communities.ts` | `hasPremiumAccess` is **set on confirm** and **returned in the community detail response**, but the post-listing endpoint does **not** gate content by it today. Why: paywall enforcement is a separate decision (hard wall vs. teaser) — schema is ready, hook isn't applied yet. |
| 3-month subscription | 🟡 | `routes/payments.ts` (`purpose=subscription_3mo`) | Activates `subscriptionExpiresAt` on the user. No automatic renewal, no cancellation flow. Why: manual lifecycle for MVP. |
| **Razorpay integration** | ❌ | Schema default is `provider="razorpay"`, admin help text references `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | **There is no Razorpay code in the backend yet.** All payments today are UPI link + admin/user manual confirm. The `RAZORPAY_*` secrets are listed as "missing" — when added, a Razorpay route will need to be built. Why: shipped UPI first because it works without third-party signup; Razorpay is the next step. |
| Stripe | ❌ | Mentioned in admin help text only | Not coded. |
| Refunds / dispute handling | ❌ | — | Manual via DB only. |

### 5.7 Health-specific Features

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| AI health Q&A (Yukti) | 🔵 | `routes/ai.ts`, `routes/publicAi.ts` | See §5.3 |
| Health search (intent-aware) | 🔵 | `routes/healthSearch.ts`, `lib/searchEngine.ts` | Classifies intent (symptom / treatment / doctor / lab / general), blends DB + OSM + AI summary |
| User consents (T&C, data sharing, etc.) | ✅ | `routes/consents.ts` | Per-user consent records |
| Symptom tracker | ❌ | — | Not implemented. The AI triage during teleconsult is the closest equivalent today. |
| Personal health records (allergies, conditions, vitals) | ❌ | — | No CRUD endpoints exist. |
| Drug / medication lookup | ❌ | — | Not implemented. AI may answer questions about meds, but there's no curated drug database. |
| Lab result upload / interpretation | ❌ | — | The `searchEngine.ts` recognizes "lab" as an intent but only returns generic guidance. No upload, no parsing. |
| Medication reminders / schedules | ❌ | — | Not implemented. |

### 5.8 Gamification

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Credits awarded for actions | ✅ | `lib/gamification.ts`, called from `routes/posts.ts` and others | Confirmed: starting a discussion + receiving upvotes / reactions |
| User level (derived from credits) | ✅ | `lib/gamification.ts` | Surfaced in profile and on every post card |
| Per-community leaderboard | ✅ | `routes/gamification.ts` | |
| Achievements | ✅ | `routes/gamification.ts`, `lib/db/schema/achievements.ts` | Per-user achievement records |
| Admin manual credit grant | ✅ | `routes/admin.ts` (`/admin/credits/award`) | |
| User credits summary endpoint | ✅ | `routes/gamification.ts` (`/users/me/credits-summary`) | |

### 5.9 Notifications

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Transactional email (OTPs, password resets, verification) | 🔵 | `lib/email.ts` | Real Resend delivery when `RESEND_API_KEY` is set (it is). Otherwise prints to server log — **never silently drops**. |
| In-app notifications feed | ❌ | — | Not implemented. No notifications table, no bell icon. |
| Push notifications (web push / FCM) | ❌ | — | Not implemented. PWA has the manifest + service worker but no push subscription flow. |
| Email digests / activity summaries | ❌ | — | Not implemented. |

### 5.10 File Uploads

| Feature | Status | Where | Notes / Why |
|---|---|---|---|
| Image / PDF upload | 🟠 | `routes/uploads.ts` (`/uploads/inline`) | **Inline base64 only** — the server validates the MIME type and 4 MB cap, then returns the same data URL. **The server does not persist the bytes**; the client embeds the data URL into the post / message. Why: avoids object-storage setup for MVP. Pros: zero infra, no leakage risk. Cons: large files cost DB row size and bloat HTML payloads. |
| Object storage (S3 / R2 / GCS) | ❌ | — | Not configured. Adding it is a future task. |
| Direct browser-to-storage uploads | ❌ | — | Not configured. |

### 5.11 Admin Console

| Feature | Status | Where |
|---|---|---|
| Stats: users, posts, AI summaries, DAU/WAU/MAU, credits, role mix | ✅ | `routes/admin.ts` (`/admin/stats`) |
| User search & role management | ✅ | `routes/admin.ts` |
| Pro-verification toggle | ✅ | `routes/admin.ts` |
| Community CRUD + member management + **public-readable toggle** | ✅ | `routes/admin.ts`, `routes/communities.ts` |
| Post moderation (pin, hide, broadcast, delete) | ✅ | `routes/admin.ts` |
| AI-summary moderation queue | ✅ | `routes/admin.ts` (`/admin/ai-summaries`) |
| Manual credit award | ✅ | `routes/admin.ts` |
| Doctor application approve / reject | ✅ | `routes/doctorApplications.ts` (admin sub-routes) |
| Broadcast composer | ✅ | `pages/admin/broadcast.tsx`, `routes/admin.ts` |
| Teleconsult oversight | ✅ | `routes/admin.ts` |
| Audit log viewer | ✅ | `routes/admin.ts` (`/admin/audit-log`) |
| Bootstrap-first-admin endpoint | ✅ | `routes/users.ts` (`/admin/bootstrap`) |

### 5.12 PWA / Install

| Feature | Status | Where | Notes |
|---|---|---|---|
| Web app manifest | ✅ | `public/manifest.json` | Icons, name, theme |
| Service worker | ✅ | `public/sw.js` | Network-first for navigations, cache-first for assets, offline fallback |
| Offline page | ✅ | `public/offline.html` | |
| "Install" button | ✅ | `components/PWAInstallButton.tsx` | Appears when the browser fires `beforeinstallprompt` |

---

## 6. Known Gaps & Honest Caveats (Consolidated)

These are real and worth knowing before any external review:

1. **Razorpay is NOT integrated.** Schema defaults to `provider="razorpay"` and admin help text mentions it, but no code calls Razorpay's API. All real payments today are UPI link + manual confirmation. The two missing secrets (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are flagged in the environment but unused. (See §5.6.)
2. **Premium paywall is recorded but not enforced.** A user who paid for a premium community is correctly marked `hasPremiumAccess=true`, but the post-listing endpoint does not currently filter content by it. The hook is one `WHERE` clause away — the product decision (hard wall vs. teaser) just hasn't been made. (See §5.6.)
3. **Moderated posts still appear in authed feeds.** Admins can mark a post `isModerated=true`, and the *new public* endpoints filter on it correctly, but the *authed* community feed does not. (See §5.2.)
4. **No object storage.** All uploads are inline base64 with a 4 MB cap. Large content is impractical. (See §5.10.)
5. **No symptom tracker, no personal health records, no drug DB, no lab-result upload.** The app is heavily centered on community + AI Q&A + teleconsult. The "personal medical record" pillar of a healthcare super-app is not built yet. (See §5.7.)
6. **No in-app or push notifications.** Only transactional email (OTP / password reset / verification). (See §5.9.)
7. **Appointment booking has no calendar logic.** It records a row with a time. No slot availability, no conflict detection, no reminders. (See §5.4.)
8. **Doctor-side persisted teleconsult messages.** In-call text relay works via the WebSocket; persisted message inserts are wired only from the patient side today. (See §5.5.)
9. **Public AI demo is heavily rate-limited** to 5 requests / hour / IP. Intentional, to prevent abuse — but worth knowing during demos.

---

## 7. Environment Requirements

What needs to be set for full functionality:

| Variable | Status in this env | What it enables |
|---|---|---|
| `DATABASE_URL` | ✅ Provided | All persistence |
| `SESSION_SECRET` | ✅ Set | Session cookie signing |
| `ADMIN_TOKEN` | ✅ Set | Server-secret admin operations |
| `RESEND_API_KEY` | ✅ Set | Real email delivery (OTP, password reset, verification) |
| `GOOGLE_CLIENT_ID` | ✅ Set | Google sign-in |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ⚠️ Required for AI | All Yukti / triage / search-summary / `@askYukti` features |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ⚠️ Required for AI | Same as above |
| `RAZORPAY_KEY_ID` | ❌ Not set | Would unlock a Razorpay route — not yet coded (see §5.6) |
| `RAZORPAY_KEY_SECRET` | ❌ Not set | Same |

When AI env vars are missing, the AI endpoints return a clear "service not configured" error. They never fall back to mock answers.

---

## 8. Quick QA Checklist

A reviewer can verify the app's claims with these steps:

- [ ] Sign up with a new email → receive an OTP → land on `/communities`.
- [ ] Create a community as an admin, toggle "Allow non-members to read posts" ON, then in a private window hit `/api/public/communities/<slug>/posts`. Posts should appear.
- [ ] Mark a post as moderated in admin. Re-hit the public endpoint. The post should disappear. (The authed feed will still show it — this is a known gap; see §6.3.)
- [ ] Post a message containing `@askYukti`. A bot comment appears within seconds (requires AI env).
- [ ] Open `/teleconsult/session/:id` in two browser tabs as the patient and the doctor. A real WebRTC connection should establish; speak / show video.
- [ ] Initiate a UPI payment → check the `payments` table for a `created` row → confirm it → check `community_members.has_premium_access`.
- [ ] As an admin, send a broadcast to a community → verify the post appears with `isBroadcast=true`.
- [ ] Hit `/api/public/ask` six times within an hour from the same IP. The 6th should 429.
- [ ] Disable JavaScript and reload the app. The PWA service worker should still serve the offline page on a fresh install.

---

*This document reflects code present in the repository as of the date above. If a feature appears below "✅" elsewhere (sales decks, screenshots, etc.) but is marked "❌" or "🟠" here, this document is the authoritative source.*
