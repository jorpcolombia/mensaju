import express from "express";
import nextImport from "next";
import { fileURLToPath } from "node:url";
import { connectDb } from "@messages/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import "./lib/redis.js";
import { setPushTransport } from "./lib/push.js";
import { createPushTransportFromEnv } from "./lib/pushTransports.js";

// next ships CJS typings; under NodeNext the default import is the module namespace.
const next = nextImport as unknown as typeof nextImport.default;

const dev = process.env.NODE_ENV !== "production";
// The Next.js app (org console, customer app at /c, admin panel at /admin) lives in
// apps/web and is served by this same process, so one service deploys everything.
const webDir = fileURLToPath(new URL("../../../apps/web", import.meta.url));

async function main() {
  await connectDb(env.mongoUri);

  const pushTransport = createPushTransportFromEnv();
  if (pushTransport) setPushTransport(pushTransport);
  else console.warn("Push: no FCM/APNs credentials configured; notifications are only logged");

  const web = next({ dev, dir: webDir });
  const handleWeb = web.getRequestHandler();
  await web.prepare();

  const server = express();
  server.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  // REST API under /api (also used by the mobile apps); everything else is the web app.
  server.use("/api", createApp());
  server.all("*", (req, res) => handleWeb(req, res));

  server.listen(env.port, () => {
    console.log(`Server (web + API) listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
