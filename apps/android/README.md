# Android (Kotlin)

Architectural skeleton per plan §11 milestone 6 — native Kotlin, mirrors the
iOS skeleton in `apps/ios`. Not a buildable Gradle project yet (no Gradle
wrapper binaries, no Android SDK config) — that setup happens when this
milestone starts in earnest.

## Structure

- `app/src/main/java/.../network/ApiClient.kt` — thin HTTP client for
  `services/api` (Ktor or Retrofit in the real build; sketched with
  `HttpURLConnection` here to avoid an unpickable dependency choice this
  early).
- `app/src/main/java/.../auth/` — customer auth (phone OTP / WhatsApp OTP /
  Google / Facebook via their Android SDKs; Apple has no native Android
  SDK — falls back to a web-based Sign in with Apple flow) and agent auth
  (messages-org Clerk session via Clerk's Android SDK).
- `app/src/main/java/.../realtime/AblyService.kt` — wraps the Ably Android
  SDK, authenticates via `POST /ably/token`.
- `app/src/main/java/.../conversations/` — conversation list + thread
  Jetpack Compose screens.
- `app/src/main/java/.../attachments/S3UploadService.kt` — presigned-URL
  upload flow, mirrors iOS.
- `app/src/main/java/.../push/` — FCM registration + handling.

## Not yet wired

- Gradle wrapper / project files (`build.gradle.kts`, `settings.gradle.kts`
  sketched below as a starting point, not verified with the Android
  toolchain)
- Google/Facebook Sign-In SDK integration (stubs only)
- FCM project configuration
