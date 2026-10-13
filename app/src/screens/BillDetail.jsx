import { useEffect, useState } from "react";
import { ExternalLink, Check, Copy, Eye, EyeOff, Pencil, Lock, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import { Avatar, whenText } from "./Bills.jsx";
import { supabase } from "../lib/supabase.js";
import { money } from "../lib/billing.js";
import { monthName, ordinal } from "../lib/dates.js";

function scheduleText(b) {
  if (b.schedule === "balance") return "Balance only, no due date";
  if (b.schedule === "per_use") return "Charged per use";
  if (!b.due_day) return "No due date yet";
  if (b.schedule === "yearly") return `${monthName(b.due_month)} ${b.due_day}, every year`;
  return `The ${ordinal(b.due_day)} of every month`;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export default function BillDetail({ item, owner, me, hh, toast, onClose, onToggle, onEdit }) {
  const { bill } = item;
  const mine = bill.owner_id === me?.id;
  const [login, setLogin] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amountDraft, setAmountDraft] = useState(item.row?.amount ?? "");

  useEffect(() => {
    if (!showPw) return;
    const t = setTimeout(() => setShowPw(false), 30000);
    return () => clearTimeout(t);
  }, [showPw]);

  const loadLogin = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("get_bill_login", { p_bill: bill.id });
    setBusy(false);
    if (error) return toast("Couldn't open the login. Try again.", "error");
    setLogin(data?.[0] || { username: null, password: null });
  };
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); toast(what + " copied"); } catch { toast("Couldn't copy on this device.", "error"); }
  };
  const dismissReview = async () => {
    hh.patchBills((bs) => bs.map((b) => (b.id === bill.id ? { ...b, needs_review: null } : b)));
    const { error } = await supabase.from("bills").update({ needs_review: null }).eq("id", bill.id);
    if (error) { toast("Couldn't save that.", "error"); hh.reload(); }
  };
  const saveMonthAmount = async (e) => {
    e.preventDefault();
    const v = amountDraft === "" ? null : Math.round(Number(amountDraft) * 100) / 100;
    if (v !== null && (!isFinite(v) || v < 0)) return toast("Enter an amount like 84.12", "error");
    const row = { bill_id: bill.id, period: item.occ.period, amount: v, paid: item.row?.paid ?? null, paid_at: item.row?.paid_at ?? null, paid_by: item.row?.paid_by ?? null };
    hh.patchPeriods((ps) => [...ps.filter((r) => !(r.bill_id === row.bill_id && r.period === row.period)), row]);
    const { error } = await supabase.from("bill_periods").upsert(row, { onConflict: "bill_id,period" });
    if (error) { toast("Couldn't save that.", "error"); hh.reload(); } else toast(`Saved ${monthName(+item.occ.period.slice(5, 7))} amount`);
  };

  const regular = !item.balanceOnly && !item.notThisMonth;
  const [when, tone] = regular ? whenText(item) : [item.balanceOnly ? "Balance owed" : "Not due this month", ""];
  const amount = item.balanceOnly ? bill.balance : regular ? item.st.amount : bill.amount;

  return (
    <Sheet title="" onClose={onClose} label={bill.name}
      actions={mine ? <button className="btn btn-glass btn-sm" onClick={onEdit}><Pencil size={15} /> Edit</button> : null}>
      <div className="detail-head">
        <Avatar bill={bill} slug={owner?.slug} />
        <div>
          <h3>{bill.name}</h3>
          <div className="meta">{bill.category}{owner && !mine ? `, ${owner.display_name}'s bill` : ""}</div>
        </div>
      </div>

      <div className="detail-amount num">{amount != null ? money(amount) : "Varies"}</div>
      <div className={"detail-status when " + tone}>{when}</div>

      {bill.needs_review && (
        <div className="callout">
          <Sparkles size={18} style={{ flex: "none", marginTop: 2 }} />
          <span>{bill.needs_review}</span>
          {mine && <button onClick={dismissReview}>Done</button>}
        </div>
      )}

      <div className="inline-actions">
        {bill.url && (
          <a className="btn btn-primary" href={bill.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} /> Pay bill
          </a>
        )}
        {regular && mine && (
          <button className={"btn " + (item.st.paid ? "btn-glass" : bill.url ? "btn-glass" : "btn-primary")} onClick={onToggle}>
            <Check size={18} /> {item.st.paid ? "Mark unpaid" : "Mark paid"}
          </button>
        )}
      </div>

      {regular && mine && (bill.amount_varies || item.row?.amount != null) && (
        <form className="group" onSubmit={saveMonthAmount}>
          <label className="row">
            <span className="k">{monthName(+item.occ.period.slice(5, 7))} amount</span>
            <input inputMode="decimal" placeholder={bill.amount != null ? money(bill.amount) : "Enter amount"} value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="This month's amount" />
            <button className="btn btn-glass btn-sm" type="submit">Save</button>
          </label>
        </form>
      )}

      <div className="group">
        <div className="row"><span className="k">Due</span><span className="v">{scheduleText(bill)}</span></div>
        {bill.schedule !== "balance" && <div className="row"><span className="k">Autopay</span><span className="v">{bill.autopay ? "On" : "Off"}</span></div>}
        <div className="row"><span className="k">Balance left</span><span className="v num">{bill.balance != null ? money(bill.balance) : "Not tracked"}</span></div>
        {bill.verification && <div className="row"><span className="k">Sign-in check</span><span className="v">{bill.verification}</span></div>}
        {bill.url && <div className="row"><span className="k">Website</span><span className="v">{host(bill.url)}</span></div>}
      </div>

      {mine ? (
        <div className="group">
          {!login ? (
            <button className="row" style={{ width: "100%" }} onClick={loadLogin} disabled={busy}>
              <Lock size={18} color="var(--accent)" />
              <span style={{ flex: 1, textAlign: "left" }}>{bill.has_login ? "Show saved login" : "No login saved"}</span>
              {busy && <span className="spin" style={{ width: 18, height: 18 }} />}
            </button>
          ) : (
            <>
              <div className="row">
                <span className="k">Username</span>
                <span className="v secret">{login.username || "Not saved"}</span>
                {login.username && <button className="mini-btn" onClick={() => copy(login.username, "Username")} aria-label="Copy username"><Copy size={16} /></button>}
              </div>
              <div className="row">
                <span className="k">Password</span>
                <span className="v secret">{login.password ? (showPw ? login.password : "••••••••••") : "Not saved"}</span>
                {login.password && <>
                  <button className="mini-btn" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button className="mini-btn" onClick={() => copy(login.password, "Password")} aria-label="Copy password"><Copy size={16} /></button>
                </>}
              </div>
            </>
          )}
        </div>
      ) : bill.has_login ? (
        <p className="field-note">Only {owner?.display_name || "the owner"} can see this bill's saved login.</p>
      ) : null}

      {bill.notes && <div className="group"><div className="notes">{bill.notes}</div></div>}
    </Sheet>
  );
}
