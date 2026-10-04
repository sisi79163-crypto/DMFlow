export function normalize(s: string) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .trim();
}
export function matches(text: string, trigger: string, keywords: string[]) {
  return (
    trigger === "any" ||
    keywords.some(
      (k) => normalize(text).includes(normalize(k)) && normalize(k).length > 0,
    )
  );
}
export function canMessage(last: Date | null, now = Date.now()) {
  return !!last && now - last.getTime() < 86400000 && now >= last.getTime();
}
export function inSchedule(
  a: { startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt > now);
}
export function inBusinessHours(
  config: unknown,
  timezone: string,
  now = new Date(),
) {
  const c = config as {
    enabled?: boolean;
    start?: number;
    end?: number;
    days?: number[];
  };
  if (!c?.enabled) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const d = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")?.value || "",
  );
  return (
    (c.days || [0, 1, 2, 3, 4, 5, 6]).includes(d) &&
    (c.start! <= c.end!
      ? h >= c.start! && h < c.end!
      : h >= c.start! || h < c.end!)
  );
}
export function variantFor(id: string) {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) | 0;
  return (n >>> 0) % 2 ? "B" : "A";
}
export const STOP_WORDS = ["stop", "unsubscribe", "توقف", "الغاء", "إلغاء"];
