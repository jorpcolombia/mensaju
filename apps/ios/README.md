# iOS (Swift)

Architectural skeleton per plan §11 milestone 5 — native Swift, no React
Native. This package lays out the structure; wiring it into a buildable
Xcode project (APNs entitlements, target settings, Sign in with Apple
capability) happens when this milestone starts in earnest.

## Structure

- `Sources/Messages/Networking/APIClient.swift` — thin HTTP client for
  `services/api`, mirrors `packages/shared-types`' API contract.
- `Sources/Messages/Auth/` — customer auth (phone OTP / WhatsApp OTP /
  Google / Apple / Facebook) and agent auth (messages-org Clerk session,
  via Clerk's iOS SDK, not shown here).
- `Sources/Messages/Realtime/AblyService.swift` — wraps `ably-cocoa`,
  authenticates via `POST /ably/token` (never holds an Ably API key
  client-side).
- `Sources/Messages/Conversations/` — conversation list + thread SwiftUI
  views, backed by `AblyService` for live updates and `APIClient` for
  history/send.
- `Sources/Messages/Attachments/S3UploadService.swift` — presigned-URL
  upload flow (`POST /attachments/presign` → direct `PUT` to S3).
- `Sources/Messages/Push/` — APNs registration + handling, tied to
  backend-triggered notifications on new messages (Milestone 7).

## Not yet wired

- Xcode project file / target configuration
- Push notification entitlements
- Sign in with Apple / Google Sign-In SDK integration (stubs only)
