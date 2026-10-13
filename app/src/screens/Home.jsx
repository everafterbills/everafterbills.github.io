import { motion } from "framer-motion";
import { ReceiptText, Settings as SettingsIcon, ChevronRight, LogIn } from "lucide-react";
import { Mark, Wordmark } from "../components/Logo.jsx";
import { greeting } from "../lib/dates.js";
import AnimatedNumber from "../components/AnimatedNumber.jsx";

export function Welcome({ theme, onSignIn }) {
  return (
    <div className="welcome">
      <Mark />
      <Wordmark />
      <motion.p className="tagline" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        Our bills, happily ever after.
      </motion.p>
      {theme.note && <motion.span className="season-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>{theme.note}</motion.span>}
      <motion.div className="cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <button className="btn btn-primary" style={{ minWidth: 220 }} onClick={onSignIn} data-autofocus>
          <LogIn size={19} /> Sign in
        </button>
      </motion.div>
    </div>
  );
}

export function HomeMenu({ me, summary, theme, onBills, onSettings, onSignOut }) {
  const first = me?.display_name || "";
  return (
    <div className="column">
      <div className="home-top">
        <Mark />
        <Wordmark as="h1" />
        {theme.note && <span className="season-note" style={{ marginTop: 6 }}>{theme.note}</span>}
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }}>
        <p className="hello">{greeting()}{first ? `, ${first}` : ""}</p>
        <p className="hello-sum">
          {summary == null ? " " : summary.open === 0
            ? "Everything's paid this month."
            : <>You have <AnimatedNumber value={summary.left} /> left to pay this month.</>}
        </p>
        <nav className="panel glass" aria-label="Main menu">
          <button className="menu-row" onClick={onBills}>
            <span className="ic"><ReceiptText size={20} /></span>
            <span className="lbl">Bills</span>
            {summary?.open > 0 && <span className="meta">{summary.open} open</span>}
            <ChevronRight size={20} color="var(--text-3)" />
          </button>
          <button className="menu-row" onClick={onSettings}>
            <span className="ic"><SettingsIcon size={20} /></span>
            <span className="lbl">Settings</span>
            <ChevronRight size={20} color="var(--text-3)" />
          </button>
        </nav>
        <button className="quiet-btn" onClick={onSignOut}>Sign out</button>
      </motion.div>
    </div>
  );
}
