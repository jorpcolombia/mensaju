function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/messages",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Extra browser origins allowed to call the API cross-origin. The bundled web app is
  // same-origin (/api), so this is only needed for other clients; empty by default.
  corsOrigins: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // A single Clerk application serves agents and admins. Admin access is granted by
  // user id in `config/admins.ts`, not by a separate Clerk app.
  clerkSecretKey: process.env.CLERK_SECRET_KEY,
  clerkWebhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,

  ablyApiKey: process.env.ABLY_API_KEY,

  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION,

  customerJwtSecret: process.env.CUSTOMER_JWT_SECRET,

  customSmsApiUrl: process.env.CUSTOM_SMS_API_URL,
  customSmsApiKey: process.env.CUSTOM_SMS_API_KEY,

  // Push. FCM: the service-account JSON (single line). APNs: .p8 key contents (escaped newlines ok).
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON,
  apnsKeyP8: process.env.APNS_KEY_P8,
  apnsKeyId: process.env.APNS_KEY_ID,
  apnsTeamId: process.env.APNS_TEAM_ID,
  apnsBundleId: process.env.APNS_BUNDLE_ID,
  apnsProduction: process.env.APNS_PRODUCTION === "true",

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,
  webBaseUrl: process.env.WEB_BASE_URL ?? "http://localhost:3000",

  // OAuth audiences (the client ids our apps are registered with); tokens
  // issued for any other app are rejected.
  googleClientIds: (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  appleClientIds: (process.env.APPLE_OAUTH_CLIENT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  whatsappCloudApiToken: process.env.WHATSAPP_CLOUD_API_TOKEN,
  whatsappCloudPhoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
};

export { required };
