# AskHealth AI Community Platform

## Overview

A full-featured healthcare community platform similar to Circle.so/Skool, optimized for the healthcare sector. Features an Admin Suite, dynamic community management, gamification, and Yukti AI assistant.

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
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/askhealth/` — Main React frontend (previewPath: `/`)
- `artifacts/api-server/` — Express API server (previewPath: `/api`)

## Key Features

### Admin Dashboard (`/admin`)
- Platform-wide stats (users, communities, posts, weekly actives)
- User management: role assignment (admin/moderator/member), ban/unban
- Community management: create, edit, archive communities
- Protected: admin role only

### Broadcast Tool (`/admin/broadcast`)
- Compose announcement, select specific communities or "Post to all"
- Creates isBroadcast posts in target communities

### Community Engine
- 3 demo communities: Clinical Ops, Revenue Cycle Management, ISB Alumni
- Rich text posts with image URL support
- Pinned posts (admin/moderator only)
- Upvotes with toggle behavior
- Comments thread

### Yukti AI Assistant
- Community-context-aware AI chat powered by OpenAI
- Shows in community sidebar
- Health-ops focused system prompt per community

### Gamification
- Health Credits: +10 start discussion, +5 comment, +2 receive upvote
- Levels 1-10: Newcomer → Health Pioneer
- Badges awarded at credit milestones
- Weekly & all-time leaderboards per community

### Global Search
- Fuzzy search across posts and members

## Database Schema

Tables: `users`, `communities`, `community_members`, `posts`, `post_upvotes`, `comments`, `achievements`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables

- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Yukti AI (OpenAI via Replit)
- `DATABASE_URL`, `PGHOST`, `PGPORT`, etc. — PostgreSQL connection
- `SESSION_SECRET` — session secret

## Routes

- `/` — Public landing page (redirects to /communities when signed in)
- `/sign-in/*?`, `/sign-up/*?` — Clerk auth pages
- `/communities` — Communities hub
- `/communities/:communityId` — Community feed with AI sidebar and leaderboard
- `/communities/:communityId/post/:postId` — Post detail with comments
- `/profile` — User profile with Health Credits and badges
- `/search` — Global fuzzy search
- `/admin` — Admin dashboard (admin only)
- `/admin/broadcast` — Broadcast tool (admin only)
