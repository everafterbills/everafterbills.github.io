export const TZ = "America/New_York";

export function nyNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour };
}
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const periodKey = (y, m) => y + "-" + String(m).padStart(2, "0") + "-01";
export const parsePeriod = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) });
const utc = (o) => Date.UTC(o.y, o.m - 1, o.d);
export const dayDiff = (a, b) => Math.round((utc(a) - utc(b)) / 86400000);
export const addMonths = (y, m, n) => { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
export const comparePeriod = (a, b) => (a.y - b.y) * 12 + (a.m - b.m);

const fmt = (o, opts) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(utc(o)));
export const monthLabel = (y, m) => fmt({ y, m, d: 1 }, { month: "long", year: "numeric" });
export const monthName = (m) => fmt({ y: 2026, m, d: 1 }, { month: "long" });
export const shortDate = (o) => fmt(o, { month: "short", day: "numeric" });
export const weekdayDate = (o) => fmt(o, { weekday: "short", month: "short", day: "numeric" });

export function isoToNyDate(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day };
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function greeting() {
  const h = nyNow().hour;
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
