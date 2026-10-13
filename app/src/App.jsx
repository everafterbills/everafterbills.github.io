import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from "framer-motion";
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
import { useToday } from "./lib/dates.js";
import { buildMonth, summarize } from "./lib/billing.js";
import { getItem, setItem } from "./lib/storage.js";
import { VERSION } from "./config.js";
import { getDemo } from "./lib/demo.js";
const DEMO = import.meta.env.DEV && location.search.includes("demo");

// A screen that is animating away stops receiving taps immediately and sits underneath the new one,
// so a slow or interrupted exit animation can never block the screen you're on.
const screenMotion = {
  enter: (d) => ({ opacity: 0, x: 36 * d }),
  center: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } },
  exit: (d) => ({ opacity: 0, x: -36 * d, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }),
};
function Screen({ dir, children }) {
  const isPresent = useIsPresent();
  return (
    <motion.main
      className="screen"
      variants={screenMotion}
      custom={dir}
      initial="enter"
      animate="center"
      exit="exit"
      style={{ pointerEvents: isPresent ? "auto" : "none", zIndex: isPresent ? 2 : 1 }}
      aria-hidden={!isPresent || undefined}
      {...(!isPresent ? { inert: "" } : {})}
    >
      {children}
    </motion.main>
  );
}

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
  const today = useToday();

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
  const go = (next, d = 1) => { if (next === screen) return; setDir(d); setScreen(next); };

  const summary = useMemo(() => {
    if (!hh.me || (hh.loading && !hh.bills.length)) return null;
    return summarize(buildMonth(hh.bills.filter((b) => b.owner_id === hh.me.id), hh.periodsByKey, today.y, today.m, today, hh.me.remind_days));
  }, [hh.me, hh.bills, hh.periodsByKey, hh.loading, today]);

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
              <Screen key="home" dir={dir}>
                {session === undefined || (session && hh.loading && !hh.me) ? (
                  <div className="welcome"><div className="spin" /></div>
                ) : signedIn ? (
                  <HomeMenu me={hh.me} summary={summary} theme={theme} onBills={() => go("bills")} onSettings={() => go("settings")} onSignOut={signOut} />
                ) : (
                  <Welcome theme={theme} onSignIn={() => setSignIn(true)} />
                )}
              </Screen>
            )}
            {screen === "bills" && signedIn && (
              <Screen key="bills" dir={dir}>
                <Bills hh={hh} toast={toast} today={today} onBack={() => go("home", -1)} />
              </Screen>
            )}
            {screen === "settings" && signedIn && (
              <Screen key="settings" dir={dir}>
                <Settings hh={hh} toast={toast} onBack={() => go("home", -1)} onShowChangelog={openLog} />
              </Screen>
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
        {signIn && !signedIn && <SignIn key="signin" onClose={() => setSignIn(false)} onSignedIn={() => { setSignIn(false); setLocked(false); setScreen("home"); }} />}
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
