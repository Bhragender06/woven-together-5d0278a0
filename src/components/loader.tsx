import { useEffect, useRef, useState } from "react";
import logo from "@/assets/medileaf-logo.png.asset.json";

/** Short first-load screen: particles + kinetic text, then fades out. Shown once per browser session. */
export function AppLoader() {
  const [phase, setPhase] = useState<"init" | "ready" | "out" | "done">("init");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem("medileaf-loaded")) { setPhase("done"); return; }
    sessionStorage.setItem("medileaf-loaded", "1");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setPhase("ready"), reduced ? 300 : 1100);
    const t2 = setTimeout(() => setPhase("out"), reduced ? 600 : 1700);
    const t3 = setTimeout(() => setPhase("done"), reduced ? 700 : 2200);
    let raf = 0;
    const c = canvas.current;
    if (c && !reduced) {
      const ctx = c.getContext("2d")!;
      const w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
      let mx = w / 2, my = h / 2;
      const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };
      window.addEventListener("pointermove", move);
      const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      const ps = Array.from({ length: 70 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, r: Math.random() * 2.5 + 1 }));
      const tick = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color;
        for (const p of ps) {
          const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy) || 1;
          if (d < 120) { p.x += (dx / d) * 2; p.y += (dy / d) * 2; }
          p.x = (p.x + p.vx + w) % w; p.y = (p.y + p.vy + h) % h;
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
      return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); [t1, t2, t3].forEach(clearTimeout); };
    }
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  if (phase === "done") return null;
  const word = phase === "init" ? "INITIALIZING" : "WORKSPACE READY";
  return (
    <div aria-live="polite" role="status" className={`loader-screen ${phase === "out" ? "loader-out" : ""}`}>
      <canvas ref={canvas} className="absolute inset-0" aria-hidden />
      <div className="relative flex flex-col items-center gap-5">
        <img src={logo.url} alt="" className="loader-logo h-20 w-20" />
        <div className="font-display text-5xl tracking-[0.3em] text-foreground">
          {"MEDILEAF".split("").map((ch, i) => <span key={i} className="kinetic-char" style={{ animationDelay: `${i * 60}ms` }}>{ch}</span>)}
        </div>
        <div key={word} className="text-xs font-semibold tracking-[0.4em] text-primary">
          {word.split("").map((ch, i) => <span key={i} className="kinetic-char" style={{ animationDelay: `${i * 25}ms` }}>{ch === " " ? "\u00a0" : ch}</span>)}
        </div>
      </div>
    </div>
  );
}
