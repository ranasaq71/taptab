"use client";
import { useEffect, useRef } from "react";

/** A statement whose words light up one by one as it scrolls through the screen. */
export default function ScrollWords({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current!;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("span"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { spans.forEach((s) => (s.style.opacity = "1")); return; }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      // 0 when the block's top reaches 85% of the screen, 1 when its bottom reaches 45%
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.4)));
      const lit = p * spans.length;
      spans.forEach((s, i) => (s.style.opacity = String(0.16 + 0.84 * Math.min(1, Math.max(0, lit - i)))));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <p ref={ref} className="lp-words">
      {words.map((w, i) => <span key={i}>{w} </span>)}
    </p>
  );
}
