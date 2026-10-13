import { nyNow } from "./dates.js";

// Gregorian Easter (Anonymous algorithm)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}
function thanksgiving(y) {
  const first = new Date(Date.UTC(y, 10, 1)).getUTCDay(); // Nov 1 weekday
  return 1 + ((4 - first + 7) % 7) + 21;
}
const dayOfYear = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);

export const THEMES = {
  default:      { id: "default",      note: null,                     aurora: ["#F2A7B8", "#B9A6F0", "#EBCB8B"], accent: "#EBCB8B", particles: null },
  newyear:      { id: "newyear",      note: "✨ Happy New Year",       aurora: ["#EBCB8B", "#B9A6F0", "#FFFFFF"], accent: "#F3D99B", particles: "sparkles" },
  valentine:    { id: "valentine",    note: "💗 Happy Valentine's Day", aurora: ["#FF7FA3", "#F2A7B8", "#C86B98"], accent: "#FF9DB7", particles: "hearts" },
  stpatrick:    { id: "stpatrick",    note: "☘️ Happy St. Patrick's Day", aurora: ["#7FD49B", "#B9E6A8", "#EBCB8B"], accent: "#9FE0B0", particles: "clovers" },
  easter:       { id: "easter",       note: "🌷 Happy Easter",          aurora: ["#F9D0E3", "#C8E7FF", "#FFF1B8"], accent: "#F7C6DA", particles: "petals" },
  july4:        { id: "july4",        note: "🎆 Happy Fourth of July",  aurora: ["#FF6B6B", "#7FA8FF", "#F5F5FF"], accent: "#9DBBFF", particles: "sparkles" },
  halloween:    { id: "halloween",    note: "🎃 Happy Halloween",       aurora: ["#FF9A3D", "#9C6BFF", "#F2A7B8"], accent: "#FFB15C", particles: "bats" },
  thanksgiving: { id: "thanksgiving", note: "🍂 Happy Thanksgiving",    aurora: ["#E8A15C", "#C46B4E", "#EBCB8B"], accent: "#F0B878", particles: "leaves" },
  winter:       { id: "winter",       note: "❄️ Cozy season",           aurora: ["#A8D8FF", "#B9A6F0", "#E6F0FF"], accent: "#BFE3FF", particles: "snow" },
  christmas:    { id: "christmas",    note: "🎄 Merry Christmas",       aurora: ["#E56B6F", "#7FC8A9", "#EBCB8B"], accent: "#F2C46D", particles: "snow" },
};

export function seasonalTheme(now = nyNow()) {
  const { y, m, d } = now;
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) return THEMES.newyear;
  if (m === 2 && d <= 14) return THEMES.valentine;
  if (m === 3 && d >= 14 && d <= 17) return THEMES.stpatrick;
  const e = easter(y), today = dayOfYear(y, m, d), eDay = dayOfYear(y, e.m, e.d);
  if (today >= eDay - 6 && today <= eDay) return THEMES.easter;
  if (m === 7 && d <= 4) return THEMES.july4;
  if (m === 10) return THEMES.halloween;
  if (m === 11) { const t = thanksgiving(y); if (d >= t - 3 && d <= t) return THEMES.thanksgiving; }
  if (m === 12 && d >= 18 && d <= 26) return THEMES.christmas;
  if (m === 11 || m === 12) return THEMES.winter;
  return THEMES.default;
}
