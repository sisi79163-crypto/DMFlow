import { z } from "zod";
import { flowSchema } from "../lib/flow";
export const automationSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    accountId: z.string(),
    mediaId: z.string().min(1),
    trigger: z.enum(["any", "keywords"]),
    keywords: z.array(z.string().min(1).max(80)).max(30),
    messageA: z.string().min(1).max(1000),
    messageB: z.string().max(1000).default(""),
    publicReply: z.string().max(500).default(""),
    cooldownHours: z.number().int().min(1).max(720).default(24),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    flow: flowSchema,
  })
  .superRefine((v, c) => {
    if (v.trigger === "keywords" && !v.keywords.length)
      c.addIssue({ code: "custom", message: "Add a keyword" });
    if (v.startsAt && v.endsAt && v.startsAt >= v.endsAt)
      c.addIssue({ code: "custom", message: "End must follow start" });
    const start = v.flow.nodes.find((n) => n.data.kind === "comment");
    const next = v.flow.edges.find((e) => e.source === start?.id)?.target;
    if (!start || v.flow.nodes.find((n) => n.id === next)?.data.kind !== "dm")
      c.addIssue({ code: "custom", message: "Start with Comment → DM" });
    if (v.flow.nodes.filter((n) => n.data.kind === "dm").length !== 1)
      c.addIssue({ code: "custom", message: "Use one initial private reply" });
    const dm = v.flow.nodes.find((n) => n.data.kind === "dm");
    const after = v.flow.edges.find((e) => e.source === dm?.id)?.target;
    if (after && v.flow.nodes.find((n) => n.id === after)?.data.kind !== "wait")
      c.addIssue({
        code: "custom",
        message: "Private reply must be followed by Wait for reply",
      });
    for (const n of v.flow.nodes) {
      if (["message", "question"].includes(n.data.kind) && !n.data.text)
        c.addIssue({ code: "custom", message: "Add message text" });
      if (n.data.kind === "link") {
        try {
          if (new URL(n.data.value || "").protocol !== "https:") throw 0;
        } catch {
          c.addIssue({ code: "custom", message: "Links must use HTTPS" });
        }
      }
    }
  });
export const settingsSchema = z.object({
  name: z.string().min(1).max(80),
  locale: z.enum(["ar", "en"]),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  aiEnabled: z.boolean(),
  aiMode: z.enum(["draft", "auto"]),
  aiInstructions: z.string().max(4000),
  businessHours: z.object({
    enabled: z.boolean(),
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(0).max(24),
    days: z.array(z.number().int().min(0).max(6)),
  }),
});
