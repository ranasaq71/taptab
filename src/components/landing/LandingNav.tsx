"use client";
import { useEffect, useState } from "react";
import TapTabLogo from "./TapTabLogo";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#pricing", label: "Pricing" },
];

/** Full menu at the top of the page; shrinks into a small floating bar once you scroll. */
export default function LandingNav() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact(window.scrollY > 90);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`lp-nav${compact ? " compact" : ""}`}>
      <a href="#top" className="lp-brand" aria-label="TapTab home">
        <TapTabLogo id="nav" />
        <span>TapTab</span>
      </a>
      <nav className="lp-chips" aria-label="Main">
        {LINKS.map((l) => <a key={l.href} href={l.href} className="lp-chip">{l.label}</a>)}
        <a href="/login" className="lp-chip">Sign in</a>
        <a href="#demo" className="lp-chip gold">Book a demo</a>
      </nav>
    </header>
  );
}
