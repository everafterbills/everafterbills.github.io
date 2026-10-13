import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Check, AlertCircle } from "lucide-react";
import Segmented from "../components/Segmented.jsx";
import PromiseRing from "../components/PromiseRing.jsx";
import AnimatedNumber from "../components/AnimatedNumber.jsx";
import { play } from "../lib/feedback.js";
import CategoryIcon from "../components/Icon.jsx";
import BillDetail from "./BillDetail.jsx";
import BillForm from "./BillForm.jsx";
import { supabase } from "../lib/supabase.js";
import { monthLabel, monthName, weekdayDate, shortDate, isoToNyDate, addMonths, comparePeriod, parsePeriod } from "../lib/dates.js";
import { buildMonth, summarize, balanceTotal, earlierUnpaid, money, iconFor } from "../lib/billing.js";
import { OWNER_COLORS } from "../config.js";

export function whenText({ st, occ, bill }) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  switch (st.status) {
    case "late": return [`${plural(-st.dueIn, "day")} late`, "late"];
    case "today": return [bill.autopay ? "Autopay today" : "Due today", "today"];
    case "soon": return [`Due in ${plural(st.dueIn, "day")}`, "soon"];
    case "upcoming":
      if (bill.schedule === "per_use") return ["Charged per use", ""];
      return [`${bill.autopay ? "Autopay" : "Due"} ${weekdayDate(occ.due)}`, ""];
    case "nodate": return ["Add a due date", ""];
    case "paid": return [st.paidAt ? `Paid ${shortDate(isoToNyDate(st.paidAt))}` : "Paid", "paid"];
    case "autopaid": return [bill.schedule === "per_use" ? "Autopay, charged per use" : `Autopaid ${shortDate(occ.due)}`, "paid"];
    default: return ["", ""];
  }
}

export function Avatar({ bill, slug, initial }) {
  const c = OWNER_COLORS[slug] || "#ebcb8b";
  return (
    <span className="avatar" style={{ background: `${c}26`, color: c, boxShadow: `inset 0 0 0 1px ${c}40` }}>
      <CategoryIcon name={iconFor(bill.category, bill.name)} />
      {initial && <span className="initial" style={{ background: c }}>{initial}</span>}
    </span>
  );
}

function BillRow({ item, ownerSlug, ownerName, showOwner, canEdit, onOpen, onToggle }) {
  const { bill, st } = item;
  const [when, tone] = item.balanceOnly ? ["Balance owed", ""] : whenText(item);
  const amount = item.balanceOnly ? bill.balance : st.amount;
  return (
    <div className="bill" data-pulse-host="">
      <button className="open" onClick={onOpen}>
        <Avatar bill={bill} slug={ownerSlug} initial={showOwner ? ownerName?.[0] : null} />
        <span className="txt">
          <span className="name" style={{ display: "block" }}>{bill.name}</span>
          <span className={"when " + tone} style={{ display: "block" }}>{when}</span>
        </span>
        <span className="amt">
          {amount != null ? <AnimatedNumber value={amount} className="amt-n" /> : <span className="num amt-n">Varies</span>}
          {bill.needs_review && <span className="small" style={{ color: "var(--accent)", display: "block" }}>Needs info</span>}
        </span>
      </button>
      {!item.balanceOnly && (
        canEdit ? (
          <button className={"check" + (st.paid ? (st.auto ? " auto" : " on") : "")} onClick={onToggle} data-sound="none"
            aria-label={st.paid ? `Mark ${bill.name} unpaid` : `Mark ${bill.name} paid`} aria-pressed={st.paid}>
            <motion.span initial={false} animate={{ scale: st.paid ? 1 : 0.4, opacity: st.paid ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }} style={{ display: "grid" }}>
              <Check size={18} strokeWidth={3} />
            </motion.span>
          </button>
        ) : (
          <span className={"check" + (st.paid ? (st.auto ? " auto" : " on") : "")} style={{ opacity: 0.7 }} aria-hidden="true">
            {st.paid && <Check size={18} strokeWidth={3} />}
          </span>
        )
      )}
    </div>
  );
}

const rowMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { height: { type: "spring", stiffness: 420, damping: 40 }, opacity: { duration: 0.22, delay: 0.05 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.26, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.14 } } },
};
const sectionMotion = {
  initial: { height: 0, opacity: 0, overflow: "hidden" },
  animate: { height: "auto", opacity: 1, transitionEnd: { overflow: "visible" }, transition: { height: { type: "spring", stiffness: 380, damping: 40 }, opacity: { duration: 0.25 } } },
  exit: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] } },
};

const GROUPS = ["Past due", "Coming up", "Needs a due date", "Paid", "Balances"];
const groupOf = (i) => (i.balanceOnly ? "Balances" : i.st.paid ? "Paid" : i.st.status === "late" ? "Past due" : i.st.status === "nodate" ? "Needs a due date" : "Coming up");

export default function Bills({ hh, onBack, toast, today }) {
  const [ym, setYm] = useState({ y: today.y, m: today.m });
  const [filter, setFilter] = useState(hh.me?.slug || "both");
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [hold, setHold] = useState({}); // billId -> group it stays in briefly after a tap
  const holdTimers = useRef({});
  const remind = hh.me?.remind_days ?? 3;
  const bySlug = Object.fromEntries(hh.profiles.map((p) => [p.slug, p]));
  const byId = Object.fromEntries(hh.profiles.map((p) => [p.id, p]));
  const ownerId = filter === "both" ? null : bySlug[filter]?.id;
  const bills = useMemo(() => hh.bills.filter((b) => !ownerId || b.owner_id === ownerId), [hh.bills, ownerId]);

  const earliest = hh.bills.reduce((min, b) => {
    const p = parsePeriod(b.start_month);
    return !min || comparePeriod(p, min) < 0 ? p : min;
  }, null) || { y: today.y, m: today.m };
  const latest = addMonths(today.y, today.m, 12);
  const canBack = comparePeriod(ym, earliest) > 0;
  const canFwd = comparePeriod(ym, latest) < 0;
  const isCurrent = ym.y === today.y && ym.m === today.m;

  const items = useMemo(() => buildMonth(bills, hh.periodsByKey, ym.y, ym.m, today, remind), [bills, hh.periodsByKey, ym.y, ym.m, today, remind]);
  const sum = summarize(items);
  const owed = balanceTotal(bills);
  const earlier = isCurrent ? earlierUnpaid(bills, hh.periodsByKey, ym.y, ym.m, today) : [];
  const balanceItems = bills.filter((b) => b.schedule === "balance").map((bill) => ({ bill, balanceOnly: true }));

  const grouped = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const it of [...items, ...balanceItems]) grouped[hold[it.bill.id] || groupOf(it)].push(it);
  const groups = GROUPS.map((g) => [g, grouped[g]]).filter(([, list]) => list.length);

  async function togglePaid(item) {
    if (item.bill.owner_id !== hh.me?.id) return;
    const paid = !item.st.paid;
    const id = item.bill.id;
    // Keep the row where it is for a beat so the check animation and sound land before it moves.
    clearTimeout(holdTimers.current[id]);
    setHold((h) => ({ ...h, [id]: h[id] || groupOf(item) }));
    holdTimers.current[id] = setTimeout(() => setHold((h) => { const n = { ...h }; delete n[id]; return n; }), 650);
    play(paid ? "paid" : "toggleOff");
    const row = { bill_id: id, period: item.occ.period, paid, paid_at: paid ? new Date().toISOString() : null,
                  paid_by: hh.me.id, amount: item.row?.amount ?? null };
    hh.patchPeriods((ps) => [...ps.filter((r) => !(r.bill_id === row.bill_id && r.period === row.period)), row]);
    const { error } = await supabase.from("bill_periods").upsert(row, { onConflict: "bill_id,period" });
    if (error) { play("error"); toast("Couldn't save that. Try again.", "error"); hh.reload(); }
  }

  const openItem = openId && (items.find((i) => i.bill.id === openId) || balanceItems.find((i) => i.bill.id === openId)
    || (hh.bills.find((b) => b.id === openId) && { bill: hh.bills.find((b) => b.id === openId), notThisMonth: true }));
  const filterOptions = [
    ...(hh.me ? [{ value: hh.me.slug, label: hh.me.display_name }] : []),
    ...(hh.spouse ? [{ value: hh.spouse.slug, label: hh.spouse.display_name }] : []),
    { value: "both", label: "Both" },
  ];

  return (
    <div className="column bills-col">
      <header className="topbar">
        <button className="icon-btn glass" onClick={onBack} aria-label="Back to home"><ChevronLeft size={22} /></button>
        <h1 className="title">Bills</h1>
        <button className="icon-btn glass" onClick={() => setForm({ bill: null })} aria-label="Add a bill"><Plus size={22} /></button>
      </header>

      <div className="bills-grid">
        <aside className="bills-side">
          <div className="month-switch glass">
            <button className="icon-btn" onClick={() => canBack && setYm(addMonths(ym.y, ym.m, -1))} disabled={!canBack} aria-label="Previous month" style={{ opacity: canBack ? 1 : 0.3 }}>
              <ChevronLeft size={20} />
            </button>
            <button className="label" onClick={() => setYm({ y: today.y, m: today.m })} aria-label="Jump to this month">
              {monthLabel(ym.y, ym.m)}
              <span className="today" style={{ visibility: isCurrent ? "hidden" : "visible" }}>Back to this month</span>
            </button>
            <button className="icon-btn" onClick={() => canFwd && setYm(addMonths(ym.y, ym.m, 1))} disabled={!canFwd} aria-label="Next month" style={{ opacity: canFwd ? 1 : 0.3 }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <Segmented id="owner" options={filterOptions} value={filter} onChange={setFilter} />

          <section className="summary glass" aria-live="polite">
            <PromiseRing fraction={sum.fraction} />
            <div className="summary-text">
              <div className="k">{sum.open === 0 && items.length ? "All paid for " + monthName(ym.m) : "Left to pay in " + monthName(ym.m)}</div>
              <AnimatedNumber value={sum.left} className="big" />
              <div className="sub">of <AnimatedNumber value={sum.due} /> due, <b><AnimatedNumber value={sum.paid} /> paid</b></div>
              {sum.variable > 0 && <div className="sub">Plus {sum.variable} {sum.variable === 1 ? "bill" : "bills"} that change each month</div>}
            </div>
          </section>

          <AnimatePresence initial={false}>
            {owed > 0 && (
              <motion.div key="owed" {...sectionMotion}>
                <div className="owed glass">
                  <span>Still owed on loans, cards and balances</span>
                  <AnimatedNumber value={owed} className="owed-n" />
                </div>
              </motion.div>
            )}
            {earlier.length > 0 && (
              <motion.div key="earlier" {...sectionMotion}>
                <button className="banner" onClick={() => setYm({ y: earlier[0].y, m: earlier[0].m })}>
                  <AlertCircle size={20} style={{ flex: "none" }} />
                  <span style={{ flex: 1 }}>
                    {earlier.length === 1 ? `${earlier[0].bill.name} from ${monthName(earlier[0].m)} isn't marked paid.` : `${earlier.length} bills from earlier months aren't marked paid.`}
                  </span>
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        <div className="bills-main">
          {hh.loading && !hh.bills.length ? <div className="loading"><div className="spin" /></div> : null}
          {!hh.loading && groups.length === 0 && (
            <p className="empty">No bills here for {monthLabel(ym.y, ym.m)}. Tap + to add one.</p>
          )}
          <AnimatePresence initial={false}>
            {groups.map(([label, list]) => (
              <motion.section key={label} {...sectionMotion}>
                <h2 className="section-h">
                  <span>{label}</span>
                  {label !== "Balances"
                    ? <AnimatedNumber value={list.reduce((s, i) => s + Math.round((Number(i.st?.amount) || 0) * 100), 0) / 100} />
                    : <AnimatedNumber value={list.reduce((s, i) => s + Math.round((Number(i.bill.balance) || 0) * 100), 0) / 100} />}
                </h2>
                <div className="panel glass">
                  <AnimatePresence initial={false}>
                    {list.map((item) => {
                      const owner = byId[item.bill.owner_id];
                      return (
                        <motion.div key={item.bill.id} className="bill-wrap" {...rowMotion}>
                          <BillRow item={item} ownerSlug={owner?.slug} ownerName={owner?.display_name}
                            showOwner={filter === "both"} canEdit={item.bill.owner_id === hh.me?.id}
                            onOpen={() => setOpenId(item.bill.id)} onToggle={() => togglePaid(item)} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {openItem && !form && (
          <BillDetail key="detail" item={openItem} owner={byId[openItem.bill.owner_id]} me={hh.me} hh={hh} toast={toast}
            onClose={() => setOpenId(null)} onToggle={() => togglePaid(openItem)} onEdit={() => setForm({ bill: openItem.bill })} />
        )}
        {form && (
          <BillForm key="form" bill={form.bill} me={hh.me} hh={hh} toast={toast}
            onClose={() => setForm(null)}
            onDeleted={() => { setForm(null); setOpenId(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
