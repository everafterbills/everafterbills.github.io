import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Bell } from "lucide-react";
import Background from "./components/Background.jsx";
import Toast from "./components/Toast.jsx";
import InstallGate from "./screens/InstallGate.jsx";
import { Welcome, HomeMenu } from "./screens/Home.jsx";
import SignIn from "./screens/SignIn.jsx";
import Bills from "./screens/Bills.jsx";
import Settings from "./screens/Settings.jsx";
import Changelog from "./screens/Changelog.jsx";
import LockScreen from "./screens/LockScreen.jsx";
import { supabase } from "./lib/supabase.js";
import { authApi, clearDevice } from "./lib/api.js";
import { useHousehold } from "./lib/useHousehold.js";
import { seasonalTheme } from "./lib/theme.js";
import { isMobile, isStandalone } from "./lib/platform.js";
import { nyNow } from "./lib/dates.js";
import { buildMonth, summarize } from "./lib/billing.js";
import { getItem, setItem } from "./lib/storage.js";
import { VERSION } from "./config.js";
import { getDemo } from "./lib/demo.js";
const DEMO = import.meta.env.DEV && location.search.includes("demo");

const push = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 } };
const pop = { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 40 } };

function useAutoLock(active, minutes, onLock) {
  useEffect(() => {
    if (!active || !minutes) return;
    const check = () => {
      const last = getItem("ea.lastSeen", 0);
      if (last && Date.now() - last > minutes * 60000) onLock();
      setItem("ea.lastSeen", Date.now());
    };
    check();
    const beat = setInterval(() => { if (!document.hidden) setItem("ea.lastSeen", Date.now()); }, 15000);
    const onVis = () => { if (document.hidden) setItem("ea.lastSeen", Date.now()); else check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(beat); document.removeEventListener("visibilitychange", onVis); };
  }, [active, minutes, onLock]);
}

export default function App() {
  const theme = useMemo(() => seasonalTheme(), []);
  const gated = isMobile() && !isStandalone();
  const [session, setSession] = useState(undefined);
  const [screen, setScreen] = useState(() => (DEMO && new URLSearchParams(location.search).get("screen")) || "home");
  const [dir, setDir] = useState(1);
  const [signIn, setSignIn] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [locked, setLocked] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [seen, setSeen] = useState(() => getItem("ea.seenVersion"));
  const hh = useHousehold(session);

  const toast = useCallback((text, tone) => {
    const id = Date.now() + Math.random();
    setToastMsg({ id, text, tone });
    setTimeout(() => setToastMsg((t) => (t?.id === id ? null : t)), 2800);
  }, []);

  useEffect(() => { document.documentElement.style.setProperty("--accent", theme.accent); }, [theme]);

  useEffect(() => {
    if (DEMO) { setSession(location.search.includes("signedout") ? null : getDemo().session); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // If this device was removed from the trusted list, sign out here too.
  useEffect(() => {
    if (!session || DEMO) return;
    authApi.status().then((r) => {
      if (r && r.trusted === false && r.setup_done !== undefined) { clearDevice(); supabase.auth.signOut(); }
    });
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lock = useCallback(() => setLocked(true), []);
  useAutoLock(!!session && !gated && !DEMO, hh.me?.autolock_minutes ?? 5, lock);

  const signOut = async () => {
    setLocked(false);
    await supabase.auth.signOut();
    setScreen("home");
  };
  const go = (next, d = 1) => { setDir(d); setScreen(next); };

  const summary = useMemo(() => {
    if (!hh.me || hh.loading) return null;
    const t = nyNow();
    return summarize(buildMonth(hh.bills.filter((b) => b.owner_id === hh.me.id), hh.periodsByKey, t.y, t.m, t, hh.me.remind_days));
  }, [hh.me, hh.bills, hh.periodsByKey, hh.loading]);

  if (gated) return (<><Background theme={theme} /><InstallGate /></>);

  const signedIn = !!session && !!hh.me;
  const openLog = () => { setShowLog(true); setItem("ea.seenVersion", VERSION); setSeen(VERSION); };

  return (
    <>
      <Background theme={theme} />
      <div className="app">
        <LayoutGroup>
          <AnimatePresence initial={false} custom={dir}>
            {screen === "home" && (
              <motion.main key="home" className="screen" {...(dir > 0 ? pop : pop)} transition={{ duration: 0.28 }}>
                {session === undefined || (session && hh.loading && !hh.me) ? (
                  <div className="welcome"><div className="spin" /></div>
                ) : signedIn ? (
                  <HomeMenu me={hh.me} summary={summary} theme={theme} onBills={() => go("bills")} onSettings={() => go("settings")} onSignOut={signOut} />
                ) : (
                  <Welcome theme={theme} onSignIn={() => setSignIn(true)} />
                )}
              </motion.main>
            )}
            {screen === "bills" && signedIn && (
              <motion.main key="bills" className="screen" {...push} transition={{ duration: 0.28 }}>
                <Bills hh={hh} toast={toast} onBack={() => go("home", -1)} />
              </motion.main>
            )}
            {screen === "settings" && signedIn && (
              <motion.main key="settings" className="screen" {...push} transition={{ duration: 0.28 }}>
                <Settings hh={hh} toast={toast} onBack={() => go("home", -1)} onShowChangelog={openLog} />
              </motion.main>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      {screen === "home" && (
        <div className="corner">
          <span className="version">v{VERSION}</span>
          {signedIn && (
            <button className="bell" onClick={openLog} aria-label="What's new">
              <Bell size={18} />
              {seen !== VERSION && <span className="dot" />}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {signIn && !signedIn && <SignIn key="signin" onClose={() => setSignIn(false)} onSignedIn={() => { setSignIn(false); setLocked(false); }} />}
        {showLog && <Changelog key="log" onClose={() => setShowLog(false)} />}
        {locked && signedIn && (
          <LockScreen key="lock" name={hh.me?.display_name} onUnlocked={() => setLocked(false)} onSignOut={signOut}
            onUntrusted={() => { clearDevice(); signOut(); }} />
        )}
      </AnimatePresence>
      <Toast toast={toastMsg} />
    </>
  );
}
