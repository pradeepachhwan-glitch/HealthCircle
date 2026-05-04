# HealthCircle Replit parity checklist

This checklist tracks the move from the old Replit-hosted HealthCircle app to
Google Cloud while keeping the product logic, access model, and mobile UX intact.

## Goal

Keep the existing HealthCircle product as the source of truth:

- patient communities and discussions
- Yukti AI chat and triage
- admin console and broadcasts
- doctor onboarding and MedPro portal
- teleconsult booking, live channel, and summaries
- PWA install/mobile navigation

The Google migration should change hosting, secrets, and data plumbing only. It
should not remove existing Replit-era workflows.

## Phase 1 - Replit parity audit

| Area | Existing code | Google dependency | Current status |
|---|---|---|---|
| PWA shell | `artifacts/askhealth`, `public/manifest.json`, `public/sw.js` | Cloud Run static serving | Built by Docker image |
| Auth/session | `/api/auth/*`, `__session` cookie, `sessions` table | `SESSION_SECRET`, HTTPS | Code present |
| Email OTP | Resend email helper | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_AUTH_ENABLED=true` | Preserved but hidden in production until sender verification is complete |
| Google login | `/api/auth/google` | `GOOGLE_CLIENT_ID` | Primary production login |
| Communities/posts | `routes/communities.ts`, `routes/posts.ts` | DB schema + data | Code present; data must be restored/seeded |
| Premium unlock | `routes/payments.ts`, UPI flow | DB data; manual confirmation | Code present |
| Admin console | `pages/admin.tsx`, `/api/admin/*` | admin role or `ADMIN_TOKEN` | Code present |
| Doctor applications | `/api/doctor-applications/*` | DB data | Code present |
| MedPro portal | `pages/medpro.tsx`, `/api/medpro/*` | `medical_professional` role | Code present |
| Providers/appointments | `routes/providers.ts`, `routes/appointments.ts` | seeded doctors/hospitals | Code present; seed required |
| Teleconsult | `/api/tc/*`, `/api/tc/ws/session/:id` | Cloud Run WebSockets, doctor linkage | Code present; doctor access fixed in this phase |
| Yukti AI | chat/search/triage AI clients | OpenAI/Anthropic env vars | Env-dependent |

## Phase 2 - Account type selection

Activ Health is a visual inspiration only. HealthCircle keeps its product model,
but now asks users which account context they want:

- `personal` - patients, family members, caregivers, community members.
- `hospital` - hospitals, clinics, care teams, and institutional partners.

Account type is metadata on the user account. It is intentionally separate from
authorization role:

- `accountType`: `personal` or `hospital`
- `role`: `member`, `moderator`, `medical_professional`, or `admin`

Initial hospital account scope is deliberately small:

- separate choice on entry
- hospital sign-in/signup path
- hospital dashboard placeholder after login
- no insurance-policy features
- no disruption to patient communities, admin, MedPro, or teleconsult logic

## Production auth mode

Current production login is Google-first / Google-only to remove the Resend OTP
dependency while the sender domain is being verified. The email/password/OTP
backend remains in place and can be restored without code changes by setting:

```bash
EMAIL_AUTH_ENABLED=true
```

and attaching working Resend secrets:

```text
RESEND_API_KEY
EMAIL_FROM
```

Google login still creates a durable `users` row in PostgreSQL, so admin role
promotion, MedPro access, doctor applications, community memberships, and audit
history continue to work from the same database model.

Firebase Hosting rewrites only forward the `__session` cookie to Cloud Run.
HealthCircle therefore issues `__session` for production auth while still
reading the old `sid` cookie for direct Cloud Run / legacy sessions.

## Phase 3 - Database and seed verification

Apply schema:

```bash
pnpm --filter @workspace/db run push
```

Seed baseline app data if a Replit database export is not restored:

```bash
pnpm --filter @workspace/db run seed-communities
pnpm --filter @workspace/db run seed-providers
```

Expected seed coverage:

- health communities such as Heart Circle, Sugar Care, Mind Space
- provider directory doctors and hospitals

If a Replit PostgreSQL export exists, prefer restoring that into Cloud SQL before
seeding so existing users, posts, roles, premium flags, doctor applications, and
teleconsult history are preserved.

## Phase 4 - Teleconsult parity

Teleconsult must support both sides of the session:

- patient owner of `tc_consultations.user_id`
- assigned doctor linked through `tc_consultations.doctor_id -> doctors.user_id`

The live channel is:

```text
/api/tc/ws/session/:consultationId
```

Expected behavior:

1. Patient books a consultation.
2. Assigned doctor can open the same consultation.
3. Patient or doctor can start the live session.
4. Both patient and assigned doctor can join the WebSocket room.
5. WebRTC signaling relays offer/answer/ICE between peers.
6. In-room chat/state messages relay live.
7. Consultation close and prescription flows remain available.

## Phase 5 - Manual parity smoke test

Run these after each Google deploy:

1. `/api/healthz` returns `{"status":"ok"}`.
2. `/account-type` shows Personal and Hospital cards.
3. Personal signup reaches `/communities`.
4. Hospital signup reaches `/hospital`.
5. Admin token recovery opens `/admin`.
6. Admin can create/edit communities and broadcast posts.
7. Member can join a community, post, comment, react, and upvote.
8. Admin can approve a doctor application.
9. Approved doctor can access `/medpro`.
10. Patient can book teleconsult with assigned doctor.
11. Doctor and patient can both join `/teleconsult/session/:id`.
12. Yukti chat responds once AI secrets are configured.
13. OTP email sends once Resend secrets are configured.

