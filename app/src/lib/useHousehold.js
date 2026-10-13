import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import { getDemo } from "./demo.js";
const DEMO = import.meta.env.DEV && typeof location !== "undefined" && location.search.includes("demo");

// Loads both profiles, every bill and every paid/unpaid record. Small enough to keep in memory.
export function useHousehold(session) {
  const uid = session?.user?.id;
  const [state, setState] = useState({ loading: true, profiles: [], bills: [], periods: [], error: null });

  const load = useCallback(async () => {
    if (DEMO) { { const d = getDemo(); setState({ loading: false, profiles: d.profiles, bills: d.bills, periods: d.periods, error: null }); }; return; }
    if (!uid) { setState({ loading: false, profiles: [], bills: [], periods: [], error: null }); return; }
    const [p, b, per] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("bills").select("*").order("name"),
      supabase.from("bill_periods").select("*"),
    ]);
    const err = p.error || b.error || per.error;
    if (err) { setState((s) => ({ ...s, loading: false, error: "Couldn't load bills. Pull to try again." })); return; }
    setState({ loading: false, profiles: p.data, bills: b.data, periods: per.data, error: null });
  }, [uid]);

  useEffect(() => { setState((s) => ({ ...s, loading: true })); load(); }, [load]);
  useEffect(() => {
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const periodsByKey = useMemo(() => {
    const m = new Map();
    for (const r of state.periods) m.set(r.bill_id + "|" + r.period, r);
    return m;
  }, [state.periods]);

  const me = state.profiles.find((p) => p.id === uid) || null;
  const spouse = state.profiles.find((p) => p.id !== uid) || null;

  return {
    ...state, me, spouse, periodsByKey, reload: load,
    patchBills: (fn) => setState((s) => ({ ...s, bills: fn(s.bills) })),
    patchPeriods: (fn) => setState((s) => ({ ...s, periods: fn(s.periods) })),
    patchProfile: (id, changes) => setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)) })),
  };
}
