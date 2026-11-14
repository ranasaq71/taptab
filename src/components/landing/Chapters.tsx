"use client";
import { useEffect, useRef, useState } from "react";

type Chapter = { label: string; title: string; body: string; cta: { label: string; href: string } };

const CHAPTERS: Chapter[] = [
  { label: "At the table", title: "The tap.", body: "A guest holds their phone to the stand and your page opens in about a second. Older phones can scan the QR code beside it. Nothing to install.", cta: { label: "Try the demo table", href: "/t/DEMO0012" } },
  { label: "While they decide", title: "The menu.", body: "Photos, prices and diet labels, in English and Spanish. Snap a photo of your printed menu and TapTab builds it for you.", cta: { label: "See the demo menu", href: "/t/DEMO0012" } },
  { label: "During the meal", title: "The service.", body: "Guests ask for help, the check or a refill. It pops up on your host-stand screen with a chime, oldest first, until someone taps Done.", cta: { label: "Book a demo", href: "#demo" } },
  { label: "On the way out", title: "The return.", body: "Every guest is offered your Google review link, unhappy guests can message the manager privately, and regulars collect stamps with their phone number.", cta: { label: "Book a demo", href: "#demo" } },
];

/**
 * Pinned, framed section: as you scroll, the chapter text and the phone screen
 * change together. Below 760px wide the chapters stack instead of pinning.
 */
export default function Chapters() {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrap.current!; const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setProgress(p);
      setActive(Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length)));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section id="how" className="lp-chapters" ref={wrap} style={{ ["--n" as string]: CHAPTERS.length }}>
      <div className="lp-pin">
        <div className="lp-frame" data-active={active}>
          <div className="lp-glow" aria-hidden />
          <Phone active={active} />
          <div className="lp-ch-text">
            {CHAPTERS.map((c, i) => (
              <div key={c.title} className={`lp-ch${i === active ? " on" : ""}`} aria-hidden={i !== active}>
                <p className="lp-label"><i />{c.label}</p>
                <h2 className="lp-ch-title"><span>{c.title}</span></h2>
              </div>
            ))}
          </div>
          <div className="lp-ch-card">
            {CHAPTERS.map((c, i) => (
              <div key={c.title} className={`lp-card-inner${i === active ? " on" : ""}`} aria-hidden={i !== active}>
                <p>{c.body}</p>
                <a href={c.cta.href} className="lp-btn gold" tabIndex={i === active ? 0 : -1}>{c.cta.label}</a>
              </div>
            ))}
          </div>
          <div className="lp-steps" aria-hidden>
            {CHAPTERS.map((c, i) => <span key={c.title} className={i <= active ? "on" : ""} />)}
            <b style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      </div>
      {/* Stacked version for small screens */}
      <div className="lp-ch-stack">
        {CHAPTERS.map((c, i) => (
          <article key={c.title} className="lp-stack-item">
            <Phone active={i} small />
            <p className="lp-label"><i />{c.label}</p>
            <h2 className="lp-ch-title"><span>{c.title}</span></h2>
            <p className="lp-stack-body">{c.body}</p>
            <a href={c.cta.href} className="lp-btn gold">{c.cta.label}</a>
          </article>
        ))}
      </div>
    </section>
  );
}

/** A phone drawn in HTML showing the real TapTab screens for each chapter. */
function Phone({ active, small }: { active: number; small?: boolean }) {
  return (
    <div className={`lp-phone${small ? " small" : ""}`} aria-hidden>
      <div className="lp-notch" />
      <div className={`lp-screen s0${active === 0 ? " on" : ""}`}>
        <div className="lock-time">7:42</div>
        <div className="lock-date">Friday</div>
        <div className="lock-notif"><img src="/brand/taptab-icon.png" alt="" /><span><b>TapTab</b><small>Open Saffron Street Kitchen</small></span></div>
        <div className="lock-tag"><span className="ring" /><span className="ring r2" /><span className="dot" /></div>
      </div>
      <div className={`lp-screen s1${active === 1 ? " on" : ""}`}>
        <div className="ph-head"><b>Menu</b><span className="ph-lang"><i>EN</i>ES</span></div>
        <div className="ph-band">Starters</div>
        {[["Charred street corn", "Masala butter, lime", "$8"], ["Chicken tikka sliders", "Mint chutney", "$12"], ["Crispy cauliflower", "Tamarind glaze", "$10"]].map(([n, d, p]) => (
          <div key={n} className="ph-dish"><span className="ph-img" /><span className="ph-txt"><b>{n}</b><small>{d}</small></span><em>{p}</em></div>
        ))}
        <div className="ph-band">Mains</div>
        <div className="ph-dish"><span className="ph-img" /><span className="ph-txt"><b>Brisket biryani 🔥</b><small>12-hour brisket</small></span><em>$19</em></div>
        <div className="ph-dish"><span className="ph-img" /><span className="ph-txt"><b>Lamb kofta wrap</b><small>Garlic yogurt, pickles</small></span><em>$15</em></div>
        <div className="ph-band">Drinks</div>
        <div className="ph-dish"><span className="ph-img" /><span className="ph-txt"><b>Mango lassi</b><small>Cardamom, honey</small></span><em>$6</em></div>
      </div>
      <div className={`lp-screen s2${active === 2 ? " on" : ""}`}>
        <div className="ph-head"><b>Call your server</b></div>
        <div className="ph-opt">🙋 <b>I need help</b></div>
        <div className="ph-opt on">🧾 <b>Bring the check</b></div>
        <div className="ph-opt">🥤 <b>Refill our drinks</b></div>
        <div className="ph-toast">Your server has been notified</div>
      </div>
      <div className={`lp-screen s3${active === 3 ? " on" : ""}`}>
        <div className="ph-head"><b>Rewards card</b></div>
        <div className="ph-stamps">{Array.from({ length: 8 }, (_, i) => <span key={i} className={i < 7 ? "on" : ""}>{i < 7 ? "✓" : ""}</span>)}</div>
        <p className="ph-small">One more visit for a free main.</p>
        <div className="ph-head sm"><b>How was everything?</b></div>
        <div className="ph-stars">★★★★★</div>
        <div className="ph-google">Post your review on Google</div>
      </div>
    </div>
  );
}
