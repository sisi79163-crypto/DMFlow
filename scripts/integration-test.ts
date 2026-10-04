// Local-only integration tests. All Meta traffic is intercepted; no Instagram messages are sent.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import assert from "node:assert/strict";
const pg = await PGlite.create();
await pg.exec(
  await readFile(
    "database/migrations/202610040001_initial/migration.sql",
    "utf8",
  ),
);
const socket = new PGLiteSocketServer({
  db: pg,
  host: "127.0.0.1",
  port: 5544,
  maxConnections: 20,
});
await socket.start();
console.log("STAGE database ready");
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5544/postgres?connection_limit=1&sslmode=disable&statement_cache_size=0&pgbouncer=true";
process.env.APP_URL = "http://127.0.0.1:3055";
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.META_APP_SECRET = "integration-only-secret";
process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-local";
process.env.META_API_VERSION = "v25.0";
process.env.REGISTRATION_ENABLED = "true";
const { db } = await import("../lib/db");
const { encrypt } = await import("../lib/security");
const { defaultFlow } = await import("../lib/flow");
const engine = await import("../workers/engine");
console.log("STAGE prisma", await db.$queryRaw`SELECT 1`);
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    "3055",
    "--hostname",
    "127.0.0.1",
  ],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
web.stderr.on("data", (d) => {
  serverOutput += d;
  console.log(String(d));
});
web.stdout.on("data", (d) => {
  serverOutput += d;
  console.log(String(d));
});
const base = process.env.APP_URL;
const realFetch = globalThis.fetch;
let calls: any[] = [];
let transport: "ok" | "timeout" | "rate" = "ok";
globalThis.fetch = (async (input: any, init: any) => {
  const url = String(input);
  if (url.startsWith("https://graph.instagram.com/")) {
    calls.push({ url, body: JSON.parse(init.body || "{}") });
    if (transport === "timeout") throw new Error("Network timeout");
    if (transport === "rate")
      return Response.json(
        { error: { code: 4, is_transient: true } },
        { status: 429 },
      );
    return Response.json({ message_id: "sent-" + calls.length });
  }
  return realFetch(input, init);
}) as typeof fetch;
let passed = 0;
function check(name: string, value: unknown) {
  assert.ok(value, name);
  passed++;
  console.log("PASS", name);
}
async function request(path: string, cookie = "", body?: any) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { Origin: base, "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, b: await r.json() };
}
try {
  for (let i = 0; i < 80; i++) {
    try {
      if (
        (
          await fetch(base + "/api/health", {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      )
        break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
    if (i === 79) throw new Error(serverOutput);
  }
  check(
    "unauthenticated workspace is denied",
    (await request("/api/workspace")).r.status === 401,
  );
  const reg = await request("/api/auth/register", "", {
    email: "one@example.test",
    password: "test-password-long",
    name: "Test Owner",
  });
  check(
    "registration creates secure session",
    reg.r.status === 200 &&
      reg.r.headers.get("set-cookie")?.includes("HttpOnly"),
  );
  const cookie = reg.r.headers.get("set-cookie")!.split(";")[0];
  const reg2 = await request("/api/auth/register", "", {
    email: "two@example.test",
    password: "another-test-long",
    name: "Other Owner",
  });
  const otherCookie = reg2.r.headers.get("set-cookie")!.split(";")[0];
  const one = await request("/api/workspace", cookie);
  check(
    "dashboard reads real zero stats",
    one.b.stats.comments === 0 && one.b.stats.sent === 0,
  );
  const wid = one.b.workspace.id;
  const bad = await fetch(base + "/api/workspace", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "notification.read", data: {} }),
  });
  check("cross-origin mutations are blocked", bad.status === 403);
  const account = await db.instagramAccount.create({
    data: {
      workspaceId: wid,
      instagramId: "ig-business",
      username: "test-business",
      tokenEncrypted: encrypt("local-token"),
      tokenExpiresAt: new Date(Date.now() + 86400000),
    },
  });
  await db.media.create({
    data: {
      id: "post-1",
      accountId: account.id,
      caption: "Test product",
      mediaType: "IMAGE",
      timestamp: new Date(),
    },
  });
  const flow = structuredClone(defaultFlow);
  flow.nodes.push(
    {
      id: "question",
      position: { x: 200, y: 390 },
      data: { kind: "question", label: "Question", text: "Which product?" },
    },
    {
      id: "condition",
      position: { x: 200, y: 520 },
      data: { kind: "condition", label: "Condition", value: "yes" },
    },
    {
      id: "yes",
      position: { x: 0, y: 650 },
      data: {
        kind: "message",
        label: "Yes",
        text: "Great, here are the details.",
      },
    },
    {
      id: "no",
      position: { x: 400, y: 650 },
      data: { kind: "message", label: "No", text: "A human can help." },
    },
  );
  flow.edges.push(
    { id: "e3", source: "wait", target: "question" },
    { id: "e4", source: "question", target: "condition" },
    { id: "e5", source: "condition", target: "yes", label: "yes" },
    { id: "e6", source: "condition", target: "no", label: "no" },
  );
  const saved = await request("/api/workspace", cookie, {
    action: "automation.save",
    data: {
      name: "Test campaign",
      accountId: account.id,
      mediaId: "post-1",
      trigger: "keywords",
      keywords: ["رابط", "السعر"],
      messageA: "A private reply",
      messageB: "B private reply",
      publicReply: "Check your inbox",
      cooldownHours: 24,
      startsAt: null,
      endsAt: null,
      flow,
    },
  });
  check(
    "automation saves paused in database",
    saved.r.ok && saved.b.enabled === false,
  );
  const aid = saved.b.id;
  check(
    "other workspace cannot modify campaign",
    (
      await request("/api/workspace", otherCookie, {
        action: "automation.toggle",
        data: { id: aid, enabled: true },
      })
    ).r.status === 404,
  );
  check(
    "campaign can be enabled",
    (
      await request("/api/workspace", cookie, {
        action: "automation.toggle",
        data: { id: aid, enabled: true },
      })
    ).r.ok,
  );
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "ig-business",
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "comments",
            value: {
              id: "comment-1",
              text: "بدي الرابط",
              from: { id: "customer-1", username: "customer" },
              media: { id: "post-1" },
            },
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(payload);
  const sig =
    "sha256=" +
    createHmac("sha256", process.env.META_APP_SECRET!)
      .update(raw)
      .digest("hex");
  check(
    "invalid webhook signature rejected",
    (
      await fetch(base + "/api/webhooks/instagram", {
        method: "POST",
        body: raw,
        headers: { "x-hub-signature-256": "invalid" },
      })
    ).status === 403,
  );
  for (let i = 0; i < 2; i++)
    check(
      "signed webhook accepted " + i,
      (
        await fetch(base + "/api/webhooks/instagram", {
          method: "POST",
          body: raw,
          headers: { "x-hub-signature-256": sig },
        })
      ).ok,
    );
  check(
    "duplicate delivery stores one event",
    (await db.webhookEvent.count()) === 1,
  );
  const event = await db.webhookEvent.findFirstOrThrow();
  await engine.processWebhook(event.id);
  await engine.processWebhook(event.id);
  check(
    "comment and private send deduplicated",
    (await db.comment.count()) === 1 &&
      (await db.message.count({ where: { kind: "private" } })) === 1,
  );
  const m = await db.message.findFirstOrThrow({ where: { kind: "private" } });
  const lead = await db.lead.findUniqueOrThrow({ where: { id: m.leadId } });
  check(
    "private comment does not open reply window",
    lead.lastInboundAt === null,
  );
  await engine.sendMessage({ messageId: m.id });
  await engine.sendMessage({ messageId: m.id });
  check(
    "private reply uses comment recipient exactly once",
    calls.length === 1 && calls[0].body.recipient.comment_id === "comment-1",
  );
  check(
    "sent message recorded",
    (await db.message.findUniqueOrThrow({ where: { id: m.id } })).status ===
      "sent",
  );
  const pub = await db.message.findFirstOrThrow({ where: { kind: "public" } });
  await engine.sendMessage({ messageId: pub.id });
  check(
    "optional public reply uses comment replies API",
    calls[1].url.includes("comment-1/replies"),
  );
  check(
    "manual DM before inbound is blocked",
    (
      await request("/api/workspace", cookie, {
        action: "message.send",
        data: {
          leadId: lead.id,
          text: "No permission",
          requestId: "manual-before-reply",
        },
      })
    ).r.status === 400,
  );
  async function inbound(mid: string, text: string) {
    const entry = {
      id: "ig-business",
      messaging: [
        {
          sender: { id: "customer-1" },
          recipient: { id: "ig-business" },
          timestamp: Date.now(),
          message: { mid, text },
        },
      ],
    };
    await db.webhookEvent.create({
      data: { id: mid, accountExternalId: "ig-business", payload: entry },
    });
    await engine.processWebhook(mid);
    await engine.processInbound(lead.id, text, mid);
  }
  await inbound("reply-1", "details");
  const question = await db.message.findFirstOrThrow({
    where: { body: "Which product?" },
  });
  const job = await db.job.findUniqueOrThrow({
    where: { key: "send:" + question.id },
  });
  await engine.sendMessage(job.payload as any);
  check(
    "user reply advances to question",
    (await db.execution.findFirstOrThrow()).state === "waiting",
  );
  await engine.processInbound(lead.id, "details", "reply-1");
  check(
    "inbound job replay creates no duplicate question",
    (await db.message.count({ where: { body: "Which product?" } })) === 1,
  );
  await inbound("reply-2", "yes please");
  const yes = await db.message.findFirstOrThrow({
    where: { body: "Great, here are the details." },
  });
  const yesjob = await db.job.findUniqueOrThrow({
    where: { key: "send:" + yes.id },
  });
  await engine.sendMessage(yesjob.payload as any);
  check(
    "condition follows yes branch",
    calls.some((c) => c.body.message?.text === "Great, here are the details."),
  );
  check(
    "flow completes",
    (await db.execution.findFirstOrThrow()).state === "completed",
  );
  const manual = {
    action: "message.send",
    data: {
      leadId: lead.id,
      text: "Human reply",
      requestId: "stable-client-request",
    },
  };
  await request("/api/workspace", cookie, manual);
  await request("/api/workspace", cookie, manual);
  check(
    "manual retries are idempotent",
    (await db.message.count({ where: { kind: "manual" } })) === 1,
  );
  const timeout = await db.message.create({
    data: {
      leadId: lead.id,
      dedupeKey: "uncertain-test",
      direction: "out",
      kind: "manual",
      body: "Transport test",
    },
  });
  transport = "timeout";
  await engine.sendMessage({ messageId: timeout.id });
  const before = calls.length;
  await engine.sendMessage({ messageId: timeout.id });
  check(
    "ambiguous send is held for review, never auto duplicated",
    (await db.message.findUniqueOrThrow({ where: { id: timeout.id } }))
      .status === "uncertain" && calls.length === before,
  );
  transport = "ok";
  await db.lead.update({
    where: { id: lead.id },
    data: { lastInboundAt: new Date(Date.now() - 90000000) },
  });
  const expired = await db.message.create({
    data: {
      leadId: lead.id,
      dedupeKey: "expired-test",
      direction: "out",
      kind: "manual",
      body: "Too late",
    },
  });
  await engine.sendMessage({ messageId: expired.id });
  check(
    "expired reply window prevents delivery",
    (await db.message.findUniqueOrThrow({ where: { id: expired.id } }))
      .status === "expired",
  );
  await inbound("stop-1", "توقف");
  check(
    "Arabic opt-out is stored",
    (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).optedOut ===
      true,
  );
  await request("/api/workspace", cookie, {
    action: "knowledge.save",
    data: { title: "Shipping", category: "shipping", content: "Tripoli only" },
  });
  check("knowledge persists", (await db.knowledge.count()) === 1);
  const link = await request("/api/workspace", cookie, {
    action: "link.create",
    data: { label: "Product", destination: "https://example.com/product" },
  });
  const redirect = await fetch(base + "/r/" + link.b.id, {
    redirect: "manual",
  });
  check(
    "tracked link redirects and counts click",
    redirect.status === 302 &&
      (await db.trackedLink.findUniqueOrThrow({ where: { id: link.b.id } }))
        .clicks === 1,
  );
  check(
    "cross-tenant inbox read denied",
    (
      await request(
        "/api/workspace?view=messages&leadId=" + lead.id,
        otherCookie,
      )
    ).r.status === 404,
  );
  const final = await request("/api/workspace", cookie);
  check(
    "dashboard reflects real event totals",
    final.r.ok && final.b.stats.comments === 1 && final.b.stats.replies === 3,
  );
  check(
    "tokens are absent from workspace response",
    !JSON.stringify(final.b).includes("tokenEncrypted") &&
      !JSON.stringify(final.b).includes("local-token"),
  );
  if (process.env.VISUAL_QA === "true") {
    const { chromium } = await import("playwright");
    const chromiumBinary = (await import("@sparticuz/chromium")).default;
    const browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.QA_CHROMIUM_EXECUTABLE_PATH ||
        (await chromiumBinary.executablePath()),
      args: chromiumBinary.args,
    });
    const context = await browser.newContext();
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: base }]);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 1040 });
    await page.goto(base);
    await page.getByRole("heading", { name: "مساحة للنمو." }).waitFor();
    await mkdir("../qa", { recursive: true });
    await page.screenshot({
      path: "../qa/dashboard-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "../qa/dashboard-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    check(
      "mobile viewport has no horizontal overflow",
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: /^الأتمتة/ }).click();
    await page.getByRole("button", { name: "تعديل التدفق" }).first().click();
    await page.screenshot({ path: "../qa/flow-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    check(
      "English changes document direction",
      await page.evaluate(() => document.documentElement.dir === "ltr"),
    );
    await page
      .getByRole("button", { name: "Toggle theme", exact: true })
      .click();
    check(
      "dark mode is applied",
      await page.evaluate(
        () => document.documentElement.dataset.theme === "dark",
      ),
    );
    await page.screenshot({
      path: "../qa/automations-dark-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await browser.close();
  }
  console.log(
    `INTEGRATION PASSED: ${passed} checks; external Meta calls were mocked.`,
  );
} finally {
  globalThis.fetch = realFetch;
  web.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  await db.$disconnect();
  await socket.stop();
  await pg.close();
}
