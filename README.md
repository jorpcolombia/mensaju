# WhatsApp Clone for Business Messaging

A WhatsApp-style messaging platform that lets **approved organizations** send real-time messages to their customers and receive replies, all from one shared conversation thread per customer. Initially available on **Android**, **iOS**, and **Web**.

## Platforms

- **Android** app
- **iOS** app
- **Web** app

All three platforms share the same conversations, message history, and account in real time — a message sent or received on one platform shows up instantly on the others.

## Core Concepts

### Organizations

Organizations (companies) are the senders on the platform — think of them as a business's support or sales team reaching out to its customers.

- A newly registered organization starts **unapproved**.
- An **admin** must manually verify and approve an organization before it gets full sending privileges (see [Approval & Rate Limiting](#approval--rate-limiting)).
- Multiple staff members ("agents") within an organization can send/receive on its behalf.

### Customers

Customers are the people organizations message. A customer is identified by **any one** of the following:

- **Phone number** (as in WhatsApp)
- **Email address**
- **Identification number** (e.g. national ID, passport, or other government ID)

Whichever identifier is used, the platform resolves it to a single customer profile, so all messages to/from that customer live in one conversation history, regardless of which identifier was used to reach them.

### Conversations

- Each organization–customer pair has one ongoing conversation thread.
- Messaging is bidirectional and real-time: the customer can reply, and the organization sees the reply appear live.

## Messaging Features

- **Real-time delivery** — messages appear instantly on both sides.
- **Rich media attachments** — a single message can include multiple attachments at once, in any combination of:
  - Images
  - Videos
  - Audio clips (e.g. voice notes)
- **Delivery status** — messages show basic sent / delivered / read status.

## Approval & Rate Limiting

To prevent spam and abuse before an organization is verified:

- **Unapproved organizations** are limited to sending **no more than 20 messages per hour**.
- Once an **admin approves** the organization, this limit is lifted and the organization can message freely.
- If an organization is later suspended or rejected, it reverts to the rate-limited (or blocked) state.

## Admin Panel

A separate **admin session**, isolated from regular organization/customer accounts, provides oversight of the platform:

- Review organizations that have registered and are pending approval.
- Approve or reject an organization's verification request.
- View and revoke the approval status of an already-approved organization.

## User Roles Summary

| Role | Can do |
|---|---|
| **Customer** | Receive messages from organizations; reply with text and media; identified by phone, email, or ID number |
| **Organization (agent)** | Send/receive real-time messages and media to customers; subject to the 20/hour cap until approved |
| **Admin** | Review, approve, reject, and revoke organization verification status |

## Assumptions & Open Questions

Since this is a functional description rather than a technical spec, a few details were originally left open. All have since been confirmed — see the "Decisions confirmed" section of the architecture plan for the resolved answers (rate limit is per-organization overall, customers can message an org first, customers use the native/web apps with OTP/OAuth login, media limits are 15MB/100MB/25MB for image/video/audio).

## Repository Layout

This is a pnpm/Turborepo monorepo implementing the architecture above:

```
apps/
  web/       # Next.js — org/agent console (messages-org Clerk app) + customer web app at /c
  admin/     # Next.js — admin panel (messages-admin Clerk app, isolated)
  ios/       # Swift source (native, no React Native) — no Xcode project yet
  android/   # Kotlin source (native) — Gradle files unverified
services/
  api/       # Node/TS REST API — auth, conversations/messages, rate
             # limiting, Ably token issuance, S3 presign, admin actions
packages/
  shared-types/  # API contract + domain types shared by web/admin/api
  db/             # Mongoose models
```

## Development

Requires `pnpm` (`pnpm@11.20.0`) and Node `>=20`. Requires local MongoDB
and Redis (or point `MONGODB_URI`/`REDIS_URL` at hosted instances), plus
Clerk (two separate apps), Ably, S3, and the custom SMS/WhatsApp Cloud
API credentials to exercise auth/messaging end-to-end.

### Quick start

```bash
pnpm install
bash scripts/setup-local-env.sh   # copies .env files + starts Mongo/Redis via docker compose
pnpm dev                          # runs api/web/admin together via turbo
```

`scripts/setup-local-env.sh` prints which env vars still need to be
filled in by hand (Clerk keys, Ably, S3, SMS/WhatsApp) after it runs.

### Manual setup

```bash
pnpm install
cp services/api/.env.example services/api/.env      # then fill in secrets
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

docker compose up -d mongo redis   # or point MONGODB_URI/REDIS_URL at hosted instances

pnpm --filter @messages/api dev      # API on :4000
pnpm --filter @messages/web dev      # Web on :3000
pnpm --filter @messages/admin dev    # Admin on :3001
```

## Status

Implemented and covered by tests (API) / built (web, admin): organizations, agents
and invites, customers (phone OTP, Google/Apple/Facebook token exchange), agent- and
customer-initiated conversations, media attachments, delivery/read status, the
20-messages-per-hour cap for unapproved organizations, the admin approval workflow,
realtime via Ably, and FCM/APNs push delivery.

Not done / not verifiable without more tooling:

- **iOS and Android apps** are source only. There is no Xcode project, the Gradle
  setup has never been built, and the Google/Apple/Facebook sign-in SDKs are stubs.
  Building them needs Xcode and the Android SDK.
- **Push** is implemented server-side but has not been exercised against real
  Firebase/Apple credentials.
- **Real-service paths** (Clerk, Ably, S3, SMS/WhatsApp, Resend) are only exercised
  through fakes in tests; the in-house SMS API contract for outreach notifications
  (`POST {CUSTOM_SMS_API_URL}/sms/send`) is an assumption.

## Deployment

Initial deploy target is **Railway** — each of `services/api`, `apps/web`,
and `apps/admin` is a separate Railway service (see each directory's
`railway.json`), with Railway's managed MongoDB and Redis plugins. S3
stays on AWS. See the architecture plan's Deployment section for details.
