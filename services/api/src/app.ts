import express, { type Express } from "express";
import { APP_NAME } from "@messages/shared-types";
import { authRouter } from "./routes/auth.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { organizationsRouter } from "./routes/organizations.js";
import { agentsRouter } from "./routes/agents.js";
import { conversationsRouter } from "./routes/conversations.js";
import { messagesRouter } from "./routes/messages.js";
import { ablyRouter } from "./routes/ably.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { adminRouter } from "./routes/admin.js";

export function createApp(): Express {
  const app = express();

  // Webhook routes need the raw body for signature verification, so they're
  // mounted before the global express.json() parser.
  app.use("/webhooks", webhooksRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: `${APP_NAME} API` });
  });

  app.use("/auth", authRouter);
  app.use("/organizations", organizationsRouter);
  app.use("/agents", agentsRouter);
  app.use("/conversations", conversationsRouter);
  app.use("/", messagesRouter); // mounts /conversations/:id/messages, /messages, /messages/:id/status
  app.use("/ably", ablyRouter);
  app.use("/attachments", attachmentsRouter);
  app.use("/admin", adminRouter);

  return app;
}
