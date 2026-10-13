import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { getDemo } from "./demo.js";

const DEMO = import.meta.env.DEV && typeof location !== "undefined" && location.search.includes("demo");

// Loads both profiles, every bill and every paid/unpaid record, and keeps them live:
// realtime updates from either phone, a refresh when the app comes back, and a slow safety refresh.
export function useHousehold(session) {
  const uid = session?.user?.id;
  const [state, setState] = useState({ loading: true, profiles: [], bills: [], periods: [], error: null });
  const version = useRef(0);      // bumps on every local change
  const inflight = useRef(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    if (DEMO) { const d = getDemo(); setState({ loading: false, profiles: d.profiles, bills: d.bills, periods: d.periods, error: null }); return; }
    if (!uid) { setState({ loading: false, profiles: [], bills: [], periods: [], error: null }); return; }
    if (inflight.current) return inflight.current;
    const startedAt = version.current;
    inflight.current = (async () => {
      const [p, b, per] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("bills").select("*").order("name"),
        supabase.from("bill_periods").select("*"),
      ]);
      inflight.current = null;
      const err = p.error || b.error || per.error;
      if (err) { setState((s) => ({ ...s, loading: false, error: "Couldn't refresh. Check your connection." })); return; }
      // A tap happened while this request was in flight: its answer may predate that change, so ask again.
      if (startedAt !== version.current) { schedule(350); return; }
      setState({ loading: false, profiles: p.data, bills: b.data, periods: per.data, error: null });
    })();
    return inflight.current;
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = useCallback((ms = 250) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(), ms);
  }, [load]);

  useEffect(() => { setState((s) => ({ ...s, loading: true })); load(); }, [load]);

  useEffect(() => {
    if (!uid || DEMO) return;
    const onVis = () => { if (!document.hidden) schedule(50); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    const slow = setInterval(() => { if (!document.hidden) schedule(0); }, 120000);
    const ch = supabase
      .channel("household-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => schedule(300))
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_periods" }, () => schedule(300))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => schedule(300))
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
      clearInterval(slow);
      clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [uid, schedule]);

  const periodsByKey = useMemo(() => {
    const m = new Map();
    for (const r of state.periods) m.set(r.bill_id + "|" + r.period, r);
    return m;
  }, [state.periods]);

  const me = state.profiles.find((p) => p.id === uid) || null;
  const spouse = state.profiles.find((p) => p.id !== uid) || null;
  const bump = () => { version.current++; };

  return {
    ...state, me, spouse, periodsByKey, reload: load,
    patchBills: (fn) => { bump(); setState((s) => ({ ...s, bills: fn(s.bills) })); },
    patchPeriods: (fn) => { bump(); setState((s) => ({ ...s, periods: fn(s.periods) })); },
    patchProfile: (id, changes) => { bump(); setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)) })); },
  };
}
