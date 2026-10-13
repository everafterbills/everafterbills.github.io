import { daysInMonth, periodKey, dayDiff, comparePeriod, parsePeriod } from "./dates.js";

const cents = (v) => Math.round(Number(v) * 100);
export const money = (v, { whole = false } = {}) =>
  v == null || v === "" ? "" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  }).format(Number(v));

// When does this bill come due in month (y, m)? null = not shown that month.
export function occurrence(bill, y, m) {
  if (bill.schedule === "balance") return null;
  if (bill.start_month && comparePeriod({ y, m }, parsePeriod(bill.start_month)) < 0) return null;
  if (bill.schedule === "yearly" && bill.due_month !== m) return null;
  const due = bill.due_day && bill.schedule !== "per_use" ? { y, m, d: Math.min(bill.due_day, daysInMonth(y, m)) } : null;
  return { period: periodKey(y, m), due };
}

// Paid/late status for one occurrence. `row` is the bill_periods row (if any).
export function billState(bill, occ, row, today, remindDays = 3) {
  const amount = row?.amount ?? bill.amount ?? null;
  const dueIn = occ.due ? dayDiff(occ.due, today) : null;
  let paid = false, auto = false;
  if (row?.paid === true) paid = true;
  else if (row?.paid === false) paid = false;
  else if (bill.autopay && (bill.schedule === "per_use" || (dueIn !== null && dueIn <= 0))) { paid = true; auto = true; }

  let status;
  if (paid) status = auto ? "autopaid" : "paid";
  else if (bill.schedule === "per_use") status = "upcoming";
  else if (dueIn === null) status = "nodate";
  else if (dueIn < 0) status = "late";
  else if (dueIn === 0) status = "today";
  else if (dueIn <= remindDays) status = "soon";
  else status = "upcoming";
  return { amount, paid, auto, status, dueIn, paidAt: row?.paid ? row.paid_at : null };
}

export function buildMonth(bills, periodsByKey, y, m, today, remindDays) {
  const items = [];
  for (const bill of bills) {
    const occ = occurrence(bill, y, m);
    if (!occ) continue;
    const row = periodsByKey.get(bill.id + "|" + occ.period);
    items.push({ bill, occ, row, st: billState(bill, occ, row, today, remindDays) });
  }
  const byDue = (a, b) => (a.occ.due?.d ?? 99) - (b.occ.due?.d ?? 99) || a.bill.name.localeCompare(b.bill.name);
  items.sort(byDue);
  return items;
}

export function summarize(items) {
  let due = 0, paid = 0, variable = 0, open = 0;
  for (const it of items) {
    if (it.st.amount == null) { variable++; if (!it.st.paid) open++; continue; }
    due += cents(it.st.amount);
    if (it.st.paid) paid += cents(it.st.amount);
    else open++;
  }
  return { due: due / 100, paid: paid / 100, left: (due - paid) / 100, variable, open, fraction: due ? paid / due : items.length ? 1 : 0 };
}

export const balanceTotal = (bills) => bills.reduce((s, b) => s + (b.balance != null ? cents(b.balance) : 0), 0) / 100;

// Unpaid occurrences in earlier months (since tracking began), for the "still unpaid" banner.
export function earlierUnpaid(bills, periodsByKey, y, m, today) {
  const found = [];
  for (let back = 1; back <= 6; back++) {
    const t = (y * 12 + (m - 1)) - back;
    const py = Math.floor(t / 12), pm = (t % 12) + 1;
    for (const bill of bills) {
      const occ = occurrence(bill, py, pm);
      if (!occ || !occ.due) continue;
      const st = billState(bill, occ, periodsByKey.get(bill.id + "|" + occ.period), today);
      if (!st.paid) found.push({ bill, y: py, m: pm });
    }
  }
  return found;
}

const ICONS = [
  [/rent|housing|mortgage/i, "home"], [/electric/i, "zap"], [/gas|fuel|heat/i, "flame"],
  [/phone|mobile|cell/i, "phone"], [/car loan|auto loan|car payment/i, "car"], [/insurance/i, "shield"],
  [/credit|card/i, "card"], [/student|loan/i, "cap"], [/stream|tv|netflix/i, "tv"], [/music|spotify/i, "music"],
  [/gam/i, "game"], [/toll/i, "road"], [/medical|doctor|health|dental/i, "pulse"], [/ai/i, "sparkle"],
  [/domain|site|hosting|web/i, "globe"], [/subscription|prime|membership/i, "package"], [/water|sewer/i, "droplet"],
  [/internet|wifi|cable/i, "wifi"],
];
export const iconFor = (category = "", name = "") => (ICONS.find(([re]) => re.test(category) || re.test(name)) || [, "receipt"])[1];

export const CATEGORY_SUGGESTIONS = [
  "Rent", "Electric", "Gas", "Water", "Internet", "Phone", "Car loan", "Car insurance", "Credit card",
  "Student loans", "Medical", "Streaming", "Music", "Subscription", "Gaming", "Tolls", "Website domain", "Other",
];
