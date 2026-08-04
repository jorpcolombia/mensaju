# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A WhatsApp-style messaging platform: approved organizations send real-time messages to customers and receive replies in one shared conversation thread per customer, across Android, iOS, and Web. See [README.md](README.md) for the full functional spec (organizations, customers, conversations, approval/rate-limiting, admin panel).

## Commands

This is a pnpm/Turborepo monorepo (`pnpm@11.20.0`, Node `>=20`). Run commands from the repo root unless noted.

```bash
pnpm install

# Run a task across all workspaces (turbo)
pnpm build
pnpm dev
pnpm lint
pnpm typecheck
pnpm test

# Run a task for a single workspace
pnpm --filter @messages/api dev        # API on :4000 (tsx watch)
pnpm --filter @messages/web dev        # Web on :3000 (Next.js)
pnpm --filter @messages/admin dev      # Admin on :3001 (Next.js)
pnpm --filter @messages/api typecheck  # tsc --noEmit
pnpm --filter @messages/api build      # tsc -p tsconfig.json
```

There is currently no test runner configured in any workspace (no `test` script exists yet), and no lint tooling is wired up despite the root `lint` turbo task.

Local env setup (API and both Next.js apps each need their own `.env`):

```bash
cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Requires local MongoDB and Redis (or hosted, via `MONGODB_URI`/`REDIS_URL`), plus two separate Clerk apps, Ably, S3, and SMS/WhatsApp Cloud API credentials to exercise auth/messaging end-to-end.

## Architecture

### Workspaces

- `services/api` — Node/TS/Express REST API: auth, conversations/messages, rate limiting, Ably token issuance, S3 presign, admin actions. Entry point `src/server.ts` → `src/app.ts` (route mounting).
- `apps/web` — Next.js console for organizations/agents (backed by a dedicated `messages-org` Clerk app).
- `apps/admin` — Next.js admin panel, intentionally isolated (backed by a separate `messages-admin` Clerk app, own session/cookies).
- `apps/ios` / `apps/android` — native Swift/Kotlin app skeletons (no React Native).
- `packages/shared-types` — API contract + domain types shared by web/admin/api (`api.ts`, `app.ts`, `models.ts`).
- `packages/db` — Mongoose models and connection, shared by services/apps that talk to MongoDB directly (e.g. `services/api`).

Workspace packages (`@messages/*`) are built via `tsc` and consumed as `workspace:*` deps, so after editing `packages/db` or `packages/shared-types` you generally need to rebuild them (`pnpm --filter @messages/db build`) before a dependent app picks up the change, unless it's run through `dev`/turbo which handles `^build` dependencies.

### Dual-auth model (the key thing to understand before touching API routes)

There are **two separate Clerk applications** plus a third, non-Clerk identity:

1. **`messages-org` Clerk app** — organization staff/agents. Verified via `requireOrgSession()` in [services/api/src/middleware/auth.ts](services/api/src/middleware/auth.ts), which sets `req.clerkUserId`. Route handlers resolve that to an internal `Agent` doc (and its `organizationId`/`role`).
2. **`messages-admin` Clerk app** — fully separate from the org app (`requireAdminSession()`), its own session/cookies, for the isolated admin panel.
3. **Customers are not Clerk users at all** — they're issued a backend-signed JWT (`lib/customerSession.ts`), verified via `requireCustomerSession()`.

Some endpoints (conversations, messages, Ably token issuance) are shared between the org/agent surface and the customer surface. These use `resolveRequester()` ([services/api/src/middleware/requester.ts](services/api/src/middleware/requester.ts)) instead of a single-role middleware: it tries an org Clerk session first (resolving to `req.agent`), then falls back to a customer JWT (`req.customerId`) — exactly one of the two ends up set. When adding a new shared route, use `resolveRequester`, not `requireOrgSession`.

### API route layout

Routes live in `services/api/src/routes/*` and are mounted in [app.ts](services/api/src/app.ts):

- `webhooks` is mounted **before** `express.json()` because signature verification needs the raw request body — keep any new webhook-style route above the JSON body parser.
- `messages` router mounts at `/` (not `/messages`) because it owns both `/conversations/:id/messages` and top-level `/messages`, `/messages/:id/status`.
- Cross-cutting logic (rate limiting, S3 presign, Ably, OTP providers, email, identity resolution) lives in `services/api/src/lib/*`, not inline in routes.

### Data model

Mongoose models in `packages/db/src/models/`: `organization`, `agent`, `admin`, `customer`, `customerIdentifier` (a customer can be looked up by phone/email/ID — see `customerIdentifier`), `conversation`, `message`, `approvalAuditLog` (tracks admin approve/reject/revoke actions on organizations).

### Deployment

Each of `services/api`, `apps/web`, `apps/admin` is a separate Railway service (see each directory's `railway.json`), with Railway's managed MongoDB and Redis. S3 stays on AWS.
