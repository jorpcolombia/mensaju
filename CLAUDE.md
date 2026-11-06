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
pnpm --filter @messages/api dev        # Monolith on :3000: Next.js (web+admin) + REST API under /api (tsx watch)
pnpm --filter @messages/api typecheck  # tsc --noEmit
pnpm --filter @messages/api build      # tsc -p tsconfig.json
```

Tests run with vitest in `services/api` (`pnpm --filter @messages/api test`). Most are unit tests with a mocked Redis; `src/routes/integration.test.ts` drives the real Express app with supertest against an in-memory MongoDB (`mongodb-memory-server`, which downloads a `mongod` binary on first run — if that is impossible the suite skips locally, and CI sets `REQUIRE_MONGO_TESTS=1` so it must run). Redis, Ably, S3 and Clerk are faked in that suite. ESLint is wired up via the root `eslint.config.mjs` and `pnpm lint`; CI (`.github/workflows/ci.yml`) runs lint, typecheck, build and test. On Windows, `pnpm build` of the Next.js apps needs `NEXT_DISABLE_STANDALONE=1` (standalone output needs symlink privileges); Docker/Railway builds keep standalone.

Local env setup (the API/server and the web app each need their own env file):

```bash
cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Requires local MongoDB and Redis (or hosted, via `MONGODB_URI`/`REDIS_URL`), plus one Clerk app, Ably, S3, and SMS/WhatsApp Cloud API credentials to exercise auth/messaging end-to-end.

## Architecture

### Workspaces

- `services/api` — the deployable **monolith**: one Node process (`src/server.ts`) that serves the Express REST API under `/api` (`src/app.ts` builds it; routes in this doc are relative to `/api`) and hands every other request to the Next.js app in `apps/web` (`next({ dir: apps/web })`). `/health` is at the root.
- `apps/web` — Next.js app: console for organizations/agents, the customer web app under `/c` (phone OTP login → backend-issued JWT in localStorage, org directory, threads; shares `components/Thread.tsx`), and the admin panel under `/admin`. It calls the API same-origin at `/api`.
- `apps/ios` / `apps/android` — native Swift/Kotlin app skeletons (no React Native).
- `packages/shared-types` — API contract + domain types shared by web/admin/api (`api.ts`, `app.ts`, `models.ts`).
- `packages/db` — Mongoose models and connection, shared by services/apps that talk to MongoDB directly (e.g. `services/api`).

Workspace packages (`@messages/*`) are built via `tsc` and consumed as `workspace:*` deps, so after editing `packages/db` or `packages/shared-types` you generally need to rebuild them (`pnpm --filter @messages/db build`) before a dependent app picks up the change, unless it's run through `dev`/turbo which handles `^build` dependencies.

### Auth model (the key thing to understand before touching API routes)

There is **one Clerk application** plus a non-Clerk customer identity:

1. **Clerk (staff and admins)** — verified via `requireOrgSession()` in [services/api/src/middleware/auth.ts](services/api/src/middleware/auth.ts), which sets `req.clerkUserId`. Route handlers resolve that to an internal `Agent` doc (and its `organizationId`/`role`).
2. **Admins are Clerk users listed in code** — `requireAdminSession()` verifies the same Clerk session and then requires `req.clerkUserId` to be in `ADMIN_CLERK_USER_IDS` in [services/api/src/config/admins.ts](services/api/src/config/admins.ts) (optionally extended by the `ADMIN_CLERK_USER_IDS` env var). Everyone else gets `403 not_admin`. The `Admin` doc is created lazily by `loadAdmin` purely as an audit-log reference.
3. **Customers are not Clerk users at all** — they're issued a backend-signed JWT (`lib/customerSession.ts`), verified via `requireCustomerSession()`.

Some endpoints (conversations, messages, Ably token issuance) are shared between the agent surface and the customer surface. These use `resolveRequester()` ([services/api/src/middleware/requester.ts](services/api/src/middleware/requester.ts)) instead of a single-role middleware: it tries a Clerk session first (resolving to `req.agent`), then falls back to a customer JWT (`req.customerId`) — exactly one of the two ends up set. When adding a new shared route, use `resolveRequester`, not `requireOrgSession`.

### API route layout

Routes live in `services/api/src/routes/*` and are mounted in [app.ts](services/api/src/app.ts) (the whole app is mounted under `/api` by `server.ts`):

- `webhooks` is mounted **before** `express.json()` because signature verification needs the raw request body — keep any new webhook-style route above the JSON body parser.
- `messages` router mounts at `/` (not `/messages`) because it owns both `/conversations/:id/messages` and top-level `/messages`, `/messages/:id/status`.
- Cross-cutting logic (rate limiting, S3 presign, Ably, OTP providers, email, identity resolution) lives in `services/api/src/lib/*`, not inline in routes.

### Messaging flow notes

- Agents can start a thread with any customer via `POST /messages` with `customer: { type, value }` (resolves/creates the customer, find-or-creates the conversation). A customer who has never signed in (`Customer.lastLoginAt` unset) gets an email/SMS heads-up (`lib/customerNotify.ts`).
- Attachments are validated against the conversation's S3 key prefix, MIME/type match, and the *stored* object size; they can only be sent into an existing thread. Message list responses embed short-lived presigned `url`s.
- Delivery status is recipient-only and monotonic (`sent` → `delivered` → `read`); `POST /conversations/:id/read` bulk-marks read.
- Ably: clients only get `subscribe`/`presence` on channels (publishing goes through the API). Each side also subscribes to a notifications channel (`org:<id>:notifications`, `customer:<id>:notifications`); on `conversation.created` the client must call `auth.authorize()` to pick up the new conversation channel.
- Push: `/devices/register` stores tokens; `lib/push.ts` fans out through a `PushTransport`. `lib/pushTransports.ts` implements FCM (HTTP v1) and APNs (HTTP/2) from `FCM_SERVICE_ACCOUNT_JSON` / `APNS_*` env; with neither set it only logs. Dead tokens are deleted on provider rejection.
- Agent invites are bound to the invitee's verified Clerk email (`lib/clerkUsers.ts`); `messagesRouter` is mounted at `/`, so it attaches `resolveRequester` per route rather than router-wide (a router-wide guard would reject admin-only routes).

### Data model

Mongoose models in `packages/db/src/models/`: `organization`, `agent`, `admin`, `customer`, `customerIdentifier` (a customer can be looked up by phone/email/ID — see `customerIdentifier`), `conversation`, `message`, `device` (push tokens), `approvalAuditLog` (tracks admin approve/reject/revoke actions on organizations).

### Deployment

One Railway service built from the repo root (`services/api/railway.json` / `services/api/Dockerfile`) serves web, admin and API on a single port. Database is **MongoDB Atlas** (`MONGODB_URI`, `mongodb+srv://…`; allow the host in Atlas Network Access); Redis from Railway; S3 on AWS. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must be present at build time. Clerk webhook endpoint: `POST /api/webhooks/clerk`.
