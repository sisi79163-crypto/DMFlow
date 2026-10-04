import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}
export function encrypt(s: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  return [
    iv.toString("base64"),
    Buffer.concat([c.update(s, "utf8"), c.final()]).toString("base64"),
    c.getAuthTag().toString("base64"),
  ].join(".");
}
export function decrypt(s: string) {
  const [iv, body, tag] = s.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}
export function signatureValid(
  body: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !secret) return false;
  const a = Buffer.from(signature),
    b = Buffer.from(
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
    );
  return a.length === b.length && timingSafeEqual(a, b);
}
export function requireOrigin(req: Request) {
  if (
    req.headers.get("origin") !==
    new URL(process.env.APP_URL || "http://localhost:3000").origin
  )
    throw new Error("FORBIDDEN");
}
