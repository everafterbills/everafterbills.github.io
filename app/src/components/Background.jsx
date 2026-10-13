import { useEffect, useRef } from "react";

// Slow aurora of the season's colors, plus a few seasonal particles.
export default function Background({ theme, calm = false }) {
  const [c1, c2, c3] = theme.aurora;
  return (
    <div className={"backdrop" + (calm ? " calm" : "")} aria-hidden="true">
      <div className="aurora a1" style={{ background: `radial-gradient(circle, ${c1} 0%, transparent 62%)` }} />
      <div className="aurora a2" style={{ background: `radial-gradient(circle, ${c2} 0%, transparent 62%)` }} />
      <div className="aurora a3" style={{ background: `radial-gradient(circle, ${c3} 0%, transparent 65%)` }} />
      <div className="grain" />
      {theme.particles && <Particles kind={theme.particles} colors={theme.aurora} paused={calm} />}
    </div>
  );
}

const COUNTS = { snow: 34, leaves: 14, bats: 6, hearts: 14, sparkles: 22, clovers: 12, petals: 16 };

function Particles({ kind, colors, paused }) {
  const ref = useRef(null);
  useEffect(() => {
    if (paused) return; // canvas fades out via CSS; no frames drawn while calm
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const rand = (a, b) => a + Math.random() * (b - a);
    const n = COUNTS[kind] || 16;
    const ps = Array.from({ length: n }, () => ({
      x: rand(0, w), y: rand(0, h), s: rand(0.6, 1.4), v: rand(0.3, 1), r: rand(0, Math.PI * 2),
      vr: rand(-0.6, 0.6), phase: rand(0, Math.PI * 2), c: colors[Math.floor(rand(0, colors.length))],
    }));

    const heart = (x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.25);
      ctx.bezierCurveTo(x - s, y + s * 0.65, x, y + s, x, y + s * 1.15);
      ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.65, x + s, y + s * 0.25);
      ctx.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3);
      ctx.fill();
    };
    const star = (x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
    };
    const bat = (x, y, s, flap) => {
      const f = Math.sin(flap) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - s * 0.6, y - s * (0.2 + f * 0.6), x - s * 1.4, y - s * (0.1 + f * 0.5));
      ctx.quadraticCurveTo(x - s * 1.0, y + s * 0.05, x - s * 0.9, y + s * 0.3);
      ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.1, x, y + s * 0.35);
      ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.1, x + s * 0.9, y + s * 0.3);
      ctx.quadraticCurveTo(x + s * 1.0, y + s * 0.05, x + s * 1.4, y - s * (0.1 + f * 0.5));
      ctx.quadraticCurveTo(x + s * 0.6, y - s * (0.2 + f * 0.6), x, y);
      ctx.fill();
    };
    const leaf = (x, y, s, r) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    const clover = (x, y, s, r) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); ctx.beginPath(); ctx.arc(0, -s * 0.7, s * 0.62, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    };

    const draw = (t) => {
      if (t - last < 31) { raf = requestAnimationFrame(draw); return; } // ~30fps is plenty for drifting particles
      const dt = Math.min(64, t - last) / 16.7; last = t;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.phase += 0.02 * dt;
        if (kind === "snow") {
          p.y += p.v * 0.7 * dt; p.x += Math.sin(p.phase) * 0.3 * dt;
          ctx.globalAlpha = 0.35 + p.s * 0.35; ctx.fillStyle = "#ffffff";
          ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.s * 1.6, 0, Math.PI * 2); ctx.fill();
        } else if (kind === "leaves" || kind === "petals") {
          p.y += p.v * 0.6 * dt; p.x += Math.sin(p.phase) * 0.6 * dt; p.r += p.vr * 0.02 * dt;
          ctx.globalAlpha = 0.45; ctx.fillStyle = p.c; leaf(p.x, p.y, 3 + p.s * 3, p.r);
        } else if (kind === "clovers") {
          p.y += p.v * 0.5 * dt; p.x += Math.sin(p.phase) * 0.4 * dt; p.r += p.vr * 0.02 * dt;
          ctx.globalAlpha = 0.4; ctx.fillStyle = "#8fe0a6"; clover(p.x, p.y, 3 + p.s * 2.5, p.r);
        } else if (kind === "hearts") {
          p.y -= p.v * 0.45 * dt; p.x += Math.sin(p.phase) * 0.35 * dt;
          ctx.globalAlpha = 0.3 + 0.25 * Math.sin(p.phase); ctx.fillStyle = p.c; heart(p.x, p.y, 4 + p.s * 4);
        } else if (kind === "sparkles") {
          ctx.globalAlpha = Math.max(0, Math.sin(p.phase * 1.3)) * 0.8; ctx.fillStyle = p.c; star(p.x, p.y, 2 + p.s * 3);
        } else if (kind === "bats") {
          p.x += p.v * 0.55 * dt; p.y += Math.sin(p.phase * 0.7) * 0.3 * dt;
          ctx.globalAlpha = 0.55; ctx.fillStyle = "#120a1c"; bat(p.x, p.y, 7 + p.s * 6, p.phase * 6);
        }
        // wrap around
        if (p.y > h + 20) { p.y = -20; p.x = rand(0, w); }
        if (p.y < -20) { p.y = h + 20; p.x = rand(0, w); }
        if (p.x > w + 30) { p.x = -30; p.y = rand(0, h * 0.7); }
        if (p.x < -30) p.x = w + 30;
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(draw); }
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, [kind, colors, paused]);
  return <canvas ref={ref} className={"particles" + (paused ? " hidden" : "")} />;
}
