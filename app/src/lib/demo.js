// Development-only sample data for screenshots (never included in the production build).
// Made-up bills: real household data lives only in Supabase.
export function getDemo() {
  const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b";
  let i = 0;
  const b = (owner, name, category, schedule, due_day, due_month, amount, extra = {}) => ({
    id: "bill-" + ++i, owner_id: owner, name, category, schedule, due_day, due_month, amount, amount_varies: false, balance: null,
    autopay: false, url: null, verification: null, notes: null, needs_review: null, has_login: false, start_month: "2026-10-01", ...extra,
  });
  return {
    session: { user: { id: A } },
    profiles: [
      { id: A, slug: "nick", display_name: "Nick", notify: true, remind_days: 3, autolock_minutes: 5 },
      { id: B, slug: "courtney", display_name: "Courtney", notify: true, remind_days: 3, autolock_minutes: 5 },
    ],
    bills: [
      b(A, "Sample Phone Co.", "Phone", "monthly", 3, null, 80, { autopay: true, url: "https://example.com/" }),
      b(A, "Sample Car Loan", "Car loan", "monthly", 28, null, 300, { url: "https://example.com/", has_login: true, needs_review: "Example of a note that needs attention." }),
      b(A, "Sample Rent", "Rent", "monthly", 30, null, 500),
      b(A, "Sample Streaming", "Streaming", "monthly", 19, null, 12, { autopay: true }),
      b(A, "Sample Toll Plan", "Toll plan", "yearly", 10, 1, 50),
      b(A, "Sample Tolls", "Tolls", "per_use", null, null, 40, { autopay: true }),
      b(B, "Sample Electric", "Electric", "monthly", 4, null, null, { amount_varies: true }),
      b(B, "Sample Store Card", "Credit card", "monthly", 11, null, 35, { balance: 400 }),
      b(B, "Sample Student Loan", "Student loans", "monthly", 23, null, 100, { balance: 5000 }),
      b(B, "Sample Music", "Music", "monthly", 30, null, 11, { autopay: true }),
      b(B, "Sample Doctor", "Medical", "balance", null, null, null, { balance: 120 }),
      b(B, "Sample Insurance", "Car insurance", "monthly", null, null, 150),
    ],
    periods: [{ bill_id: "bill-2", period: "2026-10-01", paid: true, paid_at: "2026-10-10T15:00:00Z", amount: null }],
  };
}
