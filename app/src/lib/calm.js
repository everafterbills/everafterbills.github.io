import { useEffect, useState } from "react";

// Counts open sheets so the animated background can pause behind them (keeps taps snappy on phones).
let open = 0;
const subs = new Set();
const emit = () => subs.forEach((f) => f(open));
export function sheetOpened() { open++; emit(); }
export function sheetClosed() { open = Math.max(0, open - 1); emit(); }
export function useSheetsOpen() {
  const [n, setN] = useState(open);
  useEffect(() => { subs.add(setN); return () => subs.delete(setN); }, []);
  return n > 0;
}
