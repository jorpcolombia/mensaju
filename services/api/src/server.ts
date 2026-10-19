import { connectDb } from "@messages/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import "./lib/redis.js";
import { setPushTransport } from "./lib/push.js";
import { createPushTransportFromEnv } from "./lib/pushTransports.js";

async function main() {
  await connectDb(env.mongoUri);

  const pushTransport = createPushTransportFromEnv();
  if (pushTransport) setPushTransport(pushTransport);
  else console.warn("Push: no FCM/APNs credentials configured; notifications are only logged");

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
