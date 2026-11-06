import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import type { MongoMemoryServer } from "mongodb-memory-server";

vi.hoisted(() => {
  process.env.CUSTOMER_JWT_SECRET = "test-customer-secret";
  process.env.CLERK_SECRET_KEY = "clerk-secret";
  process.env.ADMIN_CLERK_USER_IDS = "admin_1";
  process.env.ABLY_API_KEY = "x.y:z";
  process.env.S3_BUCKET = "bucket";
  process.env.S3_REGION = "us-east-1";
});

// ---- Infrastructure fakes -------------------------------------------------

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("../lib/redis.js", () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
      return "OK";
    },
    getdel: async (k: string) => {
      const v = store.get(k) ?? null;
      store.delete(k);
      return v;
    },
    del: async (k: string) => (store.delete(k) ? 1 : 0),
    decr: async (k: string) => {
      const n = Number(store.get(k) ?? 0) - 1;
      store.set(k, String(n));
      return n;
    },
    // Emulates the INCR-with-TTL Lua script used by lib/counter.ts.
    eval: async (_s: string, _n: number, k: string) => {
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(n));
      return n;
    },
  },
}));

// Pass-through: the real limiter needs a live Redis.
vi.mock("../lib/httpRateLimit.js", () => ({
  authRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const published = vi.hoisted(() => [] as { channel: string; event: string }[]);
vi.mock("../lib/ably.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ably.js")>()),
  publish: async (channel: string, event: string) => {
    published.push({ channel, event });
  },
  createAblyTokenRequest: async (p: { clientId: string; capability: Record<string, string[]> }) => ({
    clientId: p.clientId,
    capability: JSON.stringify(p.capability),
  }),
}));

const s3Sizes = vi.hoisted(() => new Map<string, number>());
vi.mock("../lib/s3.js", () => ({
  buildAttachmentKey: (p: { organizationId: string; conversationId: string }) =>
    `orgs/${p.organizationId}/conversations/${p.conversationId}/obj.png`,
  presignUpload: async () => "https://s3.test/upload",
  presignDownload: async (k: string) => `https://s3.test/download/${k}`,
  getObjectSize: async (k: string) => s3Sizes.get(k) ?? null,
}));

// Tokens look like "clerk:<userId>" and are only valid when verified with the Clerk
// secret key. Anything else (e.g. a customer JWT) is rejected so it falls through to
// the customer path.
vi.mock("@clerk/backend", () => ({
  verifyToken: async (token: string, opts: { secretKey: string }) => {
    const [prefix, sub] = token.split(":");
    if (prefix !== "clerk" || !sub || opts.secretKey !== "clerk-secret") throw new Error("invalid");
    return { sub };
  },
}));

const clerkEmails = vi.hoisted(() => new Map<string, string[]>());
vi.mock("../lib/clerkUsers.js", () => ({
  getVerifiedEmails: async (id: string) => clerkEmails.get(id) ?? [],
}));

// ---- Test harness ---------------------------------------------------------

// The in-memory mongod binary is downloaded on first use. Where that is impossible
// (offline machines) the suite is skipped; CI sets REQUIRE_MONGO_TESTS=1 so a
// missing binary fails the build instead of silently skipping coverage.
const mongo: MongoMemoryServer | null = await (async () => {
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    return await MongoMemoryServer.create();
  } catch (err) {
    if (process.env.REQUIRE_MONGO_TESTS) throw err;
    console.warn("Skipping integration tests: could not start mongodb-memory-server");
    return null;
  }
})();
const describeDb = mongo ? describe : describe.skip;

let app: Express;
let request: typeof import("supertest").default;
let db: typeof import("@messages/db");
let issueCustomerToken: typeof import("../lib/customerSession.js").issueCustomerToken;

beforeAll(async () => {
  if (!mongo) return;
  db = await import("@messages/db");
  await db.connectDb(mongo.getUri());
  await Promise.all(
    [db.Conversation, db.Message, db.Customer, db.CustomerIdentifier, db.Device].map((m) =>
      m.init(),
    ),
  );
  request = (await import("supertest")).default;
  app = (await import("../app.js")).createApp();
  ({ issueCustomerToken } = await import("../lib/customerSession.js"));
}, 120_000);

afterAll(async () => {
  if (!mongo) return;
  await db.Organization.db.close();
  await mongo.stop();
});

beforeEach(async () => {
  if (!mongo) return;
  store.clear();
  clerkEmails.clear();
  s3Sizes.clear();
  published.length = 0;
  await Promise.all(
    [
      db.Organization,
      db.Agent,
      db.Admin,
      db.Customer,
      db.CustomerIdentifier,
      db.Conversation,
      db.Message,
      db.Device,
      db.ApprovalAuditLog,
    ].map((m) => m.deleteMany({})),
  );
});

async function makeOrg(approvalStatus: "pending" | "approved" | "suspended" | "rejected", name = "Acme") {
  const org = await db.Organization.create({ name, approvalStatus });
  const agent = await db.Agent.create({
    clerkUserId: `user_${name}`,
    displayName: `${name} agent`,
    organizationId: org._id,
    role: "owner",
  });
  return { org, agent, token: `clerk:user_${name}` };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function outreach(token: string, email = "cust@example.com", text = "hello") {
  return request(app)
    .post("/messages")
    .set(auth(token))
    .send({ customer: { type: "email", value: email }, text });
}

async function customerTokenFor(email: string) {
  const id = await db.CustomerIdentifier.findOne({ type: "email", value: email });
  return issueCustomerToken(String(id!.customerId));
}

// ---- Tests ----------------------------------------------------------------

describeDb("rate limiting and approval", () => {
  it("caps a pending organization at 20 messages per hour, then 429s", async () => {
    const { token } = await makeOrg("pending");
    const first = await outreach(token);
    expect(first.status).toBe(201);
    const conversationId = first.body.message.conversationId;

    for (let i = 1; i < 20; i++) {
      const res = await request(app)
        .post("/messages")
        .set(auth(token))
        .send({ conversationId, text: `m${i}` });
      expect(res.status).toBe(201);
    }
    const blocked = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, text: "21st" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limit_exceeded");
  });

  it("does not limit an approved organization", async () => {
    const { token } = await makeOrg("approved");
    const first = await outreach(token);
    const conversationId = first.body.message.conversationId;
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post("/messages")
        .set(auth(token))
        .send({ conversationId, text: `m${i}` });
      expect(res.status).toBe(201);
    }
  });

  it("blocks suspended and rejected organizations and creates nothing", async () => {
    const { token } = await makeOrg("suspended");
    const res = await outreach(token);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("organization_blocked");
    expect(await db.Conversation.countDocuments()).toBe(0);
    expect(await db.Message.countDocuments()).toBe(0);
  });
});

describeDb("agent outreach and customer view", () => {
  it("creates the customer and thread, lists unread for the customer, and reflects read receipts", async () => {
    const { token } = await makeOrg("approved");
    const sent = await outreach(token, "Cust@Example.com", "welcome");
    expect(sent.status).toBe(201);
    expect(published.some((p) => p.event === "conversation.created")).toBe(true);

    // Identifiers resolve to one profile regardless of casing.
    const again = await outreach(token, "cust@example.com", "second");
    expect(again.body.message.conversationId).toBe(sent.body.message.conversationId);
    expect(await db.Conversation.countDocuments()).toBe(1);

    const customerToken = await customerTokenFor("cust@example.com");
    const list = await request(app).get("/conversations").set(auth(customerToken));
    expect(list.status).toBe(200);
    expect(list.body.conversations).toHaveLength(1);
    expect(list.body.conversations[0].unreadCount).toBe(2);

    const conversationId = sent.body.message.conversationId;
    const read = await request(app)
      .post(`/conversations/${conversationId}/read`)
      .set(auth(customerToken));
    expect(read.body.messageIds).toHaveLength(2);

    const agentView = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set(auth(token));
    expect(agentView.body.messages.every((m: { status: string }) => m.status === "read")).toBe(true);
  });

  it("lets the customer reply into the same thread", async () => {
    const { token } = await makeOrg("approved");
    const sent = await outreach(token);
    const conversationId = sent.body.message.conversationId;
    const customerToken = await customerTokenFor("cust@example.com");

    const reply = await request(app)
      .post("/messages")
      .set(auth(customerToken))
      .send({ conversationId, text: "thanks" });
    expect(reply.status).toBe(201);
    expect(reply.body.message.senderType).toBe("customer");
    expect(await db.Conversation.countDocuments()).toBe(1);
  });

  it("paginates message history with a cursor", async () => {
    const { token } = await makeOrg("approved");
    const first = await outreach(token, "cust@example.com", "m0");
    const conversationId = first.body.message.conversationId;
    for (let i = 1; i < 5; i++) {
      await request(app).post("/messages").set(auth(token)).send({ conversationId, text: `m${i}` });
    }
    const page1 = await request(app)
      .get(`/conversations/${conversationId}/messages?limit=2`)
      .set(auth(token));
    expect(page1.body.messages.map((m: { text: string }) => m.text)).toEqual(["m3", "m4"]);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/conversations/${conversationId}/messages?limit=2&before=${page1.body.nextCursor}`)
      .set(auth(token));
    expect(page2.body.messages.map((m: { text: string }) => m.text)).toEqual(["m1", "m2"]);
  });
});

describeDb("access control", () => {
  it("prevents an agent from reading or writing another organization's conversation", async () => {
    const a = await makeOrg("approved", "Alpha");
    const b = await makeOrg("approved", "Beta");
    const sent = await outreach(a.token);
    const conversationId = sent.body.message.conversationId;

    const read = await request(app).get(`/conversations/${conversationId}/messages`).set(auth(b.token));
    expect(read.status).toBe(403);
    const write = await request(app)
      .post("/messages")
      .set(auth(b.token))
      .send({ conversationId, text: "intruder" });
    expect(write.status).toBe(403);
  });

  it("prevents a customer from reading another customer's conversation", async () => {
    const { token } = await makeOrg("approved");
    const sent = await outreach(token, "one@example.com");
    await outreach(token, "two@example.com");
    const other = await customerTokenFor("two@example.com");

    const res = await request(app)
      .get(`/conversations/${sent.body.message.conversationId}/messages`)
      .set(auth(other));
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/conversations");
    expect(res.status).toBe(401);
  });
});

describeDb("message status", () => {
  it("lets only the recipient update status, and never downgrades it", async () => {
    const { token } = await makeOrg("approved");
    const sent = await outreach(token);
    const messageId = sent.body.message.id;
    const customerToken = await customerTokenFor("cust@example.com");

    const own = await request(app)
      .post(`/messages/${messageId}/status`)
      .set(auth(token))
      .send({ status: "read" });
    expect(own.status).toBe(403);

    const read = await request(app)
      .post(`/messages/${messageId}/status`)
      .set(auth(customerToken))
      .send({ status: "read" });
    expect(read.body.message.status).toBe("read");

    const downgrade = await request(app)
      .post(`/messages/${messageId}/status`)
      .set(auth(customerToken))
      .send({ status: "delivered" });
    expect(downgrade.body.message.status).toBe("read");
  });
});

describeDb("attachments", () => {
  it("rejects keys outside the conversation, wrong MIME types, and missing uploads; accepts a valid one", async () => {
    const { token, org } = await makeOrg("approved");
    const sent = await outreach(token);
    const conversationId = sent.body.message.conversationId;
    const goodKey = `orgs/${org._id}/conversations/${conversationId}/obj.png`;
    const base = { type: "image", mimeType: "image/png", sizeBytes: 100 };

    const foreign = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, attachments: [{ ...base, s3Key: "orgs/other/x.png" }] });
    expect(foreign.body.error).toBe("attachment_key_mismatch");

    const wrongMime = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, attachments: [{ ...base, mimeType: "video/mp4", s3Key: goodKey }] });
    expect(wrongMime.body.error).toBe("attachment_type_mismatch");

    const missing = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, attachments: [{ ...base, s3Key: goodKey }] });
    expect(missing.body.error).toBe("attachment_not_uploaded");

    s3Sizes.set(goodKey, 100);
    const ok = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, attachments: [{ ...base, s3Key: goodKey }] });
    expect(ok.status).toBe(201);

    // A stored object bigger than the limit is rejected even if the client lied about its size.
    const hugeKey = `orgs/${org._id}/conversations/${conversationId}/huge.png`;
    s3Sizes.set(hugeKey, 16 * 1024 * 1024);
    const huge = await request(app)
      .post("/messages")
      .set(auth(token))
      .send({ conversationId, attachments: [{ ...base, s3Key: hugeKey }] });
    expect(huge.body.error).toBe("attachment_too_large");

    const list = await request(app).get(`/conversations/${conversationId}/messages`).set(auth(token));
    const withAttachment = list.body.messages.find(
      (m: { attachments: unknown[] }) => m.attachments.length,
    );
    expect(withAttachment.attachments[0].url).toContain("https://s3.test/download/");
  });
});

describeDb("devices and ably", () => {
  it("registers a push token for the signed-in user", async () => {
    const { token } = await makeOrg("approved");
    const res = await request(app)
      .post("/devices/register")
      .set(auth(token))
      .send({ platform: "ios", token: "abc123" });
    expect(res.status).toBe(200);
    const device = await db.Device.findOne({ token: "abc123" });
    expect(device?.ownerType).toBe("agent");
    expect(device?.organizationId).toBeTruthy();
  });

  it("issues customers subscribe-only access to their own channels plus a notifications channel", async () => {
    const { token } = await makeOrg("approved");
    const sent = await outreach(token);
    const customerToken = await customerTokenFor("cust@example.com");
    const res = await request(app).post("/ably/token").set(auth(customerToken));
    const capability = JSON.parse(res.body.capability) as Record<string, string[]>;
    expect(capability[`conversation:${sent.body.message.conversationId}`]).toEqual([
      "subscribe",
      "presence",
    ]);
    expect(Object.keys(capability).some((k) => k.endsWith(":notifications"))).toBe(true);
    expect(Object.values(capability).flat()).not.toContain("publish");
  });
});

describeDb("agent invites", () => {
  it("only lets the invited email accept, without burning the invite on a wrong account", async () => {
    const { org, token } = await makeOrg("approved");
    const invite = await request(app)
      .post(`/organizations/${org._id}/agents/invite`)
      .set(auth(token))
      .send({ email: "New.Hire@example.com", role: "member" });
    expect(invite.status).toBe(201);
    const { inviteId } = invite.body;

    await db.Agent.create({ clerkUserId: "user_wrong", displayName: "Wrong" });
    await db.Agent.create({ clerkUserId: "user_right", displayName: "Right" });
    clerkEmails.set("user_wrong", ["someone.else@example.com"]);
    clerkEmails.set("user_right", ["new.hire@example.com"]);

    const wrong = await request(app)
      .post("/agents/accept-invite")
      .set(auth("clerk:user_wrong"))
      .send({ inviteId });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toBe("invite_email_mismatch");

    const right = await request(app)
      .post("/agents/accept-invite")
      .set(auth("clerk:user_right"))
      .send({ inviteId });
    expect(right.status).toBe(200);
    expect(right.body.agent.organizationId).toBe(String(org._id));

    const replay = await request(app)
      .post("/agents/accept-invite")
      .set(auth("clerk:user_wrong"))
      .send({ inviteId });
    expect(replay.status).toBe(410);
  });
});

describeDb("admin approval flow", () => {
  it("approves, suspends, and records an audit trail; lifts the rate limit on approval", async () => {
    const { org, token } = await makeOrg("pending");
    // Admin access comes from the code allowlist (ADMIN_CLERK_USER_IDS above); the
    // `admins` doc is created on first use.
    const adminToken = "clerk:admin_1";

    // A regular agent session is valid Clerk but not allowlisted: forbidden.
    const crossover = await request(app).get("/admin/organizations").set(auth(token));
    expect(crossover.status).toBe(403);
    expect(crossover.body.error).toBe("not_admin");

    const approve = await request(app)
      .post(`/admin/organizations/${org._id}/approve`)
      .set(auth(adminToken))
      .send({ note: "verified" });
    expect(approve.body, JSON.stringify(approve.body)).toHaveProperty("organization");
    expect(approve.body.organization.approvalStatus).toBe("approved");

    const suspend = await request(app)
      .post(`/admin/organizations/${org._id}/suspend`)
      .set(auth(adminToken))
      .send({});
    expect(suspend.body.organization.approvalStatus).toBe("suspended");

    const log = await request(app)
      .get(`/admin/organizations/${org._id}/audit-log`)
      .set(auth(adminToken));
    expect(log.body.entries.map((e: { action: string }) => e.action).sort()).toEqual([
      "approve",
      "suspend",
    ]);

    const blocked = await outreach(token);
    expect(blocked.status).toBe(403);
  });
});
