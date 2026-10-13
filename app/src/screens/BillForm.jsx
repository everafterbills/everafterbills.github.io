import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import Segmented from "../components/Segmented.jsx";
import Toggle from "../components/Toggle.jsx";
import { supabase } from "../lib/supabase.js";
import { CATEGORY_SUGGESTIONS } from "../lib/billing.js";
import { monthName, ordinal } from "../lib/dates.js";

const toNum = (v) => (v === "" || v == null ? null : Math.round(Number(v) * 100) / 100);
const clean = (v) => (v == null ? "" : String(v));

export default function BillForm({ bill, me, hh, toast, onClose, onDeleted }) {
  const editing = !!bill;
  const [f, setF] = useState(() => ({
    name: clean(bill?.name), category: clean(bill?.category || ""), schedule: bill?.schedule || "monthly",
    due_day: clean(bill?.due_day), due_month: clean(bill?.due_month || ""), amount: clean(bill?.amount),
    amount_varies: !!bill?.amount_varies, balance: clean(bill?.balance), autopay: !!bill?.autopay,
    url: clean(bill?.url), verification: clean(bill?.verification), notes: clean(bill?.notes),
  }));
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginLoaded, setLoginLoaded] = useState(!editing);
  const [loginTouched, setLoginTouched] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!editing || !bill.has_login) { setLoginLoaded(true); return; }
    supabase.rpc("get_bill_login", { p_bill: bill.id }).then(({ data }) => {
      if (data?.[0]) setLogin({ username: data[0].username || "", password: data[0].password || "" });
      setLoginLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    const name = f.name.trim();
    if (!name) return setErr("Give the bill a name.");
    const needsDay = f.schedule === "monthly" || f.schedule === "yearly";
    if (f.schedule === "yearly" && (!f.due_month || !f.due_day)) return setErr("Pick the month and day it's due each year.");
    for (const [k, label] of [["amount", "Amount"], ["balance", "Balance left"]]) {
      if (f[k] !== "" && !(Number(f[k]) >= 0)) return setErr(`${label} should be a number, like 125.50.`);
    }
    if (f.schedule !== "balance" && !f.amount_varies && f.amount === "") return setErr("Add the amount, or turn on \"Amount changes each month\".");
    let url = f.url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    if (url && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(url)) return setErr("The website should look like https://example.com.");

    const row = {
      name, category: f.category.trim() || "Other", schedule: f.schedule,
      due_day: needsDay && f.due_day ? Number(f.due_day) : null,
      due_month: f.schedule === "yearly" ? Number(f.due_month) : null,
      amount: f.schedule === "balance" ? null : toNum(f.amount),
      amount_varies: f.schedule !== "balance" && f.amount_varies,
      balance: toNum(f.balance), autopay: f.schedule !== "balance" && f.autopay,
      url: url || null, verification: f.verification.trim() || null, notes: f.notes.trim() || null,
    };
    setBusy(true);
    let id = bill?.id;
    if (editing) {
      const { error } = await supabase.from("bills").update(row).eq("id", id);
      if (error) { setBusy(false); return setErr("Couldn't save. Try again."); }
    } else {
      const { data, error } = await supabase.from("bills").insert({ ...row, owner_id: me.id }).select("id").single();
      if (error) { setBusy(false); return setErr("Couldn't add the bill. Try again."); }
      id = data.id;
    }
    if (loginTouched || (!editing && (login.username || login.password))) {
      const { error } = await supabase.rpc("set_bill_login", { p_bill: id, p_username: login.username, p_password: login.password });
      if (error) { setBusy(false); await hh.reload(); return setErr("The bill saved, but the login didn't. Try saving again."); }
    }
    await hh.reload();
    setBusy(false);
    toast(editing ? "Bill saved" : "Bill added");
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("bills").delete().eq("id", bill.id);
    setBusy(false);
    if (error) return setErr("Couldn't delete. Try again.");
    hh.patchBills((bs) => bs.filter((b) => b.id !== bill.id));
    toast("Bill deleted");
    onDeleted();
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <Sheet title={editing ? "Edit bill" : "New bill"} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="group">
          <label className="row"><span className="k">Name</span>
            <input value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="Electric" maxLength={80} data-autofocus={editing ? undefined : ""} /></label>
          <label className="row"><span className="k">Type</span>
            <input list="cats" value={f.category} onChange={(e) => set("category")(e.target.value)} placeholder="Credit card" maxLength={40} /></label>
          <datalist id="cats">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
        </div>

        <p className="field-note" style={{ margin: "14px 8px 6px" }}>Repeats</p>
        <Segmented id="sched" value={f.schedule} onChange={set("schedule")}
          options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }, { value: "per_use", label: "Per use" }, { value: "balance", label: "Balance" }]} />
        {f.schedule === "balance" && <p className="field-note">For something you owe without a set due date, like a medical bill.</p>}
        {f.schedule === "per_use" && <p className="field-note">For charges like tolls. Shows every month with an estimated amount.</p>}

        <div className="group">
          {f.schedule === "yearly" && (
            <label className="row"><span className="k">Month</span>
              <select value={f.due_month} onChange={(e) => set("due_month")(e.target.value)}>
                <option value="">Choose</option>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}
              </select></label>
          )}
          {(f.schedule === "monthly" || f.schedule === "yearly") && (
            <label className="row"><span className="k">Due day</span>
              <select value={f.due_day} onChange={(e) => set("due_day")(e.target.value)}>
                <option value="">Not set</option>
                {days.map((d) => <option key={d} value={d}>{f.schedule === "yearly" ? d : `The ${ordinal(d)}`}</option>)}
              </select></label>
          )}
          {f.schedule !== "balance" && <>
            <label className="row"><span className="k">{f.schedule === "per_use" ? "Est. per month" : "Amount"}</span>
              <input inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={f.amount_varies ? "Optional" : "0.00"} /></label>
            <div className="row"><span className="k" style={{ flex: 1 }}>Amount changes each month</span>
              <Toggle checked={f.amount_varies} onChange={set("amount_varies")} label="Amount changes each month" /></div>
            <div className="row"><span className="k" style={{ flex: 1 }}>Autopay</span>
              <Toggle checked={f.autopay} onChange={set("autopay")} label="Autopay" /></div>
          </>}
          <label className="row"><span className="k">Balance left</span>
            <input inputMode="decimal" value={f.balance} onChange={(e) => set("balance")(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Optional" /></label>
        </div>
        {f.autopay && f.schedule === "monthly" && <p className="field-note">Autopay bills check themselves off on their due date.</p>}

        <div className="group">
          <label className="row"><span className="k">Website</span>
            <input inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck="false" value={f.url}
              onChange={(e) => set("url")(e.target.value)} placeholder="https://" /></label>
          <label className="row"><span className="k">Username</span>
            <input autoCapitalize="off" autoCorrect="off" spellCheck="false" autoComplete="off" value={login.username} disabled={!loginLoaded}
              onChange={(e) => { setLogin((l) => ({ ...l, username: e.target.value })); setLoginTouched(true); }} placeholder="Optional" maxLength={200} /></label>
          <label className="row"><span className="k">Password</span>
            <input type={showPw ? "text" : "password"} autoComplete="new-password" value={login.password} disabled={!loginLoaded}
              onChange={(e) => { setLogin((l) => ({ ...l, password: e.target.value })); setLoginTouched(true); }} placeholder="Optional" maxLength={200} />
            <button type="button" className="mini-btn" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></label>
          <label className="row"><span className="k">Sign-in check</span>
            <input value={f.verification} onChange={(e) => set("verification")(e.target.value)} placeholder="Text code, app…" maxLength={60} /></label>
        </div>
        <p className="field-note">Logins are encrypted, and only you can see yours.</p>

        <div className="group">
          <label className="row" style={{ alignItems: "flex-start" }}>
            <span className="sr-only">Notes</span>
            <textarea value={f.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Notes" maxLength={1000} rows={3} />
          </label>
        </div>

        {err && <p className="field-error" role="alert">{err}</p>}
        <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add bill"}</button>

        {editing && (!confirmDelete ? (
          <button type="button" className="btn btn-danger btn-wide" style={{ marginTop: 10 }} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={17} /> Delete bill
          </button>
        ) : (
          <div className="callout" style={{ background: "rgba(255,138,122,.1)", borderColor: "rgba(255,138,122,.35)", color: "#ffd3cc", flexDirection: "column" }}>
            <span>Delete {bill.name}? Its paid history and saved login go with it.</span>
            <div className="inline-actions" style={{ width: "100%", margin: "8px 0 0" }}>
              <button type="button" className="btn btn-glass btn-sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>Delete</button>
            </div>
          </div>
        ))}
      </form>
    </Sheet>
  );
}
