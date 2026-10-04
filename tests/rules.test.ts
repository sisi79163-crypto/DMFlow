import { describe, it, expect } from "vitest";
import {
  normalize,
  matches,
  canMessage,
  inBusinessHours,
  inSchedule,
  variantFor,
} from "../lib/rules";
import { encrypt, decrypt, signatureValid } from "../lib/security";
import { createHmac, randomBytes } from "node:crypto";
import { flowSchema, defaultFlow } from "../lib/flow";
describe("Arabic and English triggers", () => {
  it("normalizes diacritics, alef and tatweel", () =>
    expect(normalize("أَرْسِــل")).toBe("ارسل"));
  it("matches multiple keywords and case", () => {
    expect(matches("Send LINK please", "keywords", ["رابط", "link"])).toBe(
      true,
    );
    expect(matches("بدي السعر", "keywords", ["السعر"])).toBe(true);
  });
  it("never matches empty keywords", () =>
    expect(matches("anything", "keywords", [""])).toBe(false));
  it("supports any comment", () => expect(matches("hi", "any", [])).toBe(true));
});
describe("Messaging constraints", () => {
  it("requires an inbound message in 24 hours", () => {
    expect(canMessage(null)).toBe(false);
    expect(canMessage(new Date(Date.now() - 86400000))).toBe(false);
    expect(canMessage(new Date(Date.now() - 1000))).toBe(true);
    expect(canMessage(new Date(Date.now() + 10000))).toBe(false);
  });
  it("respects campaign boundaries", () =>
    expect(
      inSchedule(
        { startsAt: new Date("2030-01-01"), endsAt: null },
        new Date("2026-01-01"),
      ),
    ).toBe(false));
  it("respects timezone and overnight hours", () => {
    expect(
      inBusinessHours(
        { enabled: true, start: 22, end: 6, days: [0] },
        "UTC",
        new Date("2026-10-04T23:00:00Z"),
      ),
    ).toBe(true);
    expect(
      inBusinessHours(
        { enabled: true, start: 9, end: 17, days: [1] },
        "UTC",
        new Date("2026-10-04T12:00:00Z"),
      ),
    ).toBe(false);
  });
  it("assigns a stable variant", () =>
    expect(variantFor("lead-123")).toBe(variantFor("lead-123")));
});
describe("Cryptographic boundaries", () => {
  it("encrypts and detects tampering", () => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const c = encrypt("secret");
    expect(c).not.toContain("secret");
    expect(decrypt(c)).toBe("secret");
    expect(() => decrypt(c.slice(0, -4) + "abcd")).toThrow();
  });
  it("validates exact webhook bytes", () => {
    const raw = '{"entry":[]}',
      sig =
        "sha256=" + createHmac("sha256", "test-key").update(raw).digest("hex");
    expect(signatureValid(raw, sig, "test-key")).toBe(true);
    expect(signatureValid(raw + " ", sig, "test-key")).toBe(false);
    expect(signatureValid(raw, "short", "test-key")).toBe(false);
  });
});
describe("Flow validation", () => {
  it("accepts the starter", () =>
    expect(flowSchema.safeParse(defaultFlow).success).toBe(true));
  it("rejects cycles", () =>
    expect(
      flowSchema.safeParse({
        ...defaultFlow,
        edges: [
          ...defaultFlow.edges,
          { id: "cycle", source: "wait", target: "start" },
        ],
      }).success,
    ).toBe(false));
  it("rejects dangling edges", () =>
    expect(
      flowSchema.safeParse({
        ...defaultFlow,
        edges: [{ id: "bad", source: "start", target: "missing" }],
      }).success,
    ).toBe(false));
  it("requires yes/no condition branches", () =>
    expect(
      flowSchema.safeParse({
        nodes: [
          {
            id: "c",
            position: { x: 0, y: 0 },
            data: { kind: "comment", label: "Comment" },
          },
          {
            id: "x",
            position: { x: 0, y: 1 },
            data: { kind: "condition", label: "Condition" },
          },
        ],
        edges: [{ id: "a", source: "c", target: "x" }],
      }).success,
    ).toBe(false));
});
