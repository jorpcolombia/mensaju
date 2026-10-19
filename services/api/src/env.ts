function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/messages",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Comma-separated list of allowed browser origins (apps/web, apps/admin).
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Two separate Clerk applications — org/agent auth and admin auth are
  // architecturally isolated, not just role-gated. See plan §3.
  clerkOrgSecretKey: process.env.CLERK_ORG_SECRET_KEY,
  clerkAdminSecretKey: process.env.CLERK_ADMIN_SECRET_KEY,
  clerkOrgWebhookSigningSecret: process.env.CLERK_ORG_WEBHOOK_SIGNING_SECRET,
  clerkAdminWebhookSigningSecret: process.env.CLERK_ADMIN_WEBHOOK_SIGNING_SECRET,

  ablyApiKey: process.env.ABLY_API_KEY,

  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION,

  customerJwtSecret: process.env.CUSTOMER_JWT_SECRET,

  customSmsApiUrl: process.env.CUSTOM_SMS_API_URL,
  customSmsApiKey: process.env.CUSTOM_SMS_API_KEY,

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

  // Only these emails may become admins when they sign up to the admin Clerk app.
  adminAllowedEmails: (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  whatsappCloudApiToken: process.env.WHATSAPP_CLOUD_API_TOKEN,
  whatsappCloudPhoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
};

export { required };
