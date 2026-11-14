"use client";
import { useEffect, useRef } from "react";

/**
 * Slow gold particle field that drifts along a soft flow, with a "tap" ripple
 * every few seconds from the right side of the hero. Pauses off-screen and
 * draws a single still frame when reduced motion is requested.
 */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, t = 0;
    type P = { x: number; y: number; life: number; speed: number };
    let parts: P[] = [];
    const rings: { r: number; a: number }[] = [];

    const tapPoint = () => ({ x: w * (w < 700 ? 0.72 : 0.68), y: h * 0.42 });
    const spawn = (): P => ({ x: Math.random() * w, y: Math.random() * h, life: 60 + Math.random() * 240, speed: 0.35 + Math.random() * 0.75 });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(1400, (w * h) / 900));
      parts = Array.from({ length: n }, spawn);
      ctx.fillStyle = "#1A070D"; ctx.fillRect(0, 0, w, h);
    }

    // Smooth, cheap flow field: angle from layered sine waves, curling around the tap point.
    function angle(x: number, y: number) {
      const s = 0.0019, c = tapPoint();
      const base = Math.sin(x * s + t * 0.00018) * 1.6 + Math.cos(y * s * 1.3 - t * 0.00012) * 1.4 + Math.sin((x + y) * s * 0.6) * 0.8;
      const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) + 1;
      const swirl = Math.atan2(dy, dx) + Math.PI / 2;
      const k = Math.max(0, 1 - d / (Math.min(w, h) * 0.55));
      return base * (1 - k) + swirl * k;
    }

    function frame(now: number) {
      t = now;
      ctx.fillStyle = "rgba(26, 7, 13, 0.08)"; // fade trails
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 0.8;
      for (const p of parts) {
        const a = angle(p.x, p.y);
        const nx = p.x + Math.cos(a) * p.speed, ny = p.y + Math.sin(a) * p.speed;
        const glow = 0.18 + 0.5 * Math.max(0, 1 - Math.hypot(p.x - tapPoint().x, p.y - tapPoint().y) / (Math.min(w, h) * 0.6));
        ctx.strokeStyle = `rgba(214, 174, 98, ${Math.min(0.85, glow * 0.95)})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny; p.life--;
        if (p.life <= 0 || p.x < -5 || p.y < -5 || p.x > w + 5 || p.y > h + 5) Object.assign(p, spawn());
      }
      // Tap ripple
      if (Math.floor(now / 4200) !== Math.floor((now - 17) / 4200)) rings.push({ r: 6, a: 0.55 });
      const c = tapPoint();
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        ctx.strokeStyle = `rgba(242, 215, 155, ${g.a})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(c.x, c.y, g.r, 0, Math.PI * 2); ctx.stroke();
        g.r += 1.6; g.a *= 0.985;
        if (g.a < 0.02) rings.splice(i, 1);
      }
      if (visible) raf = requestAnimationFrame(frame);
    }

    resize();
    if (reduce) {
      visible = false; // draw a still frame only
      for (let i = 0; i < 160; i++) frame(i * 16);
    } else raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([e]) => {
      const was = visible; visible = e.isIntersecting && !document.hidden;
      if (visible && !was && !reduce) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const onVis = () => { const was = visible; visible = !document.hidden; if (visible && !was && !reduce) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="lp-hero-canvas" aria-hidden />;
}
