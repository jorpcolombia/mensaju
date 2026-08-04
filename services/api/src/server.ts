import { connectDb } from "@messages/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import "./lib/redis.js";

async function main() {
  await connectDb(env.mongoUri);

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
