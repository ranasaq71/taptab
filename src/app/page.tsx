import type { Metadata } from "next";
import HeroWaves from "@/components/landing/HeroWaves";
import LandingNav from "@/components/landing/LandingNav";
import ScrollWords from "@/components/landing/ScrollWords";
import Chapters from "@/components/landing/Chapters";
import DemoForm from "@/components/landing/DemoForm";
import "./landing.css";

export const metadata: Metadata = {
  title: "TapTab: one tap for the menu, service and rewards",
  description: "Guests tap their phone on a TapTab stand to open your menu, call a server, leave a review and collect rewards. No app to download. For restaurants and food trucks.",
  openGraph: { title: "TapTab", description: "One tap for the menu, service and rewards. No app.", images: ["/icon.png"] },
};

const VENUES = ["Restaurants", "Food trucks", "Cafés", "Bars", "Food halls", "Hotel lobbies", "Coffee carts", "Pop-ups"];

const PLANS = [
  { name: "Essential", price: 39, line: "Everything a guest needs at the table.", items: ["One location", "NFC stands with QR backup", "Menu with photos, in English and Spanish", "Google reviews and private notes", "Rewards card"] },
  { name: "Pro", price: 59, line: "For busy floors that run on speed.", items: ["Everything in Essential", "Live service requests and host screen", "Text alerts to the right server", "Analytics and busiest hours"], featured: true },
  { name: "Business", price: 99, line: "For groups with more than one door.", items: ["Everything in Pro", "Multiple locations", "Priority setup and support"] },
];

export default function Home() {
  return (
    <div className="lp" id="top">
      <LandingNav />

      <section className="lp-hero">
        <HeroWaves />
        <div className="lp-hero-copy">
          <h1>One tap.<br />The whole table.</h1>
          <p>Guests hold their phone to a TapTab stand to see your menu, call a server, leave a review and collect rewards. No app to download.</p>
        </div>
        <aside className="lp-hero-card">
          <p className="lp-label"><i />Live demo</p>
          <p>Open the same page a guest sees at table 12 of our demo restaurant.</p>
          <a href="/t/DEMO0012" className="lp-btn gold">Try the demo table</a>
        </aside>
      </section>

      <section className="lp-statement">
        <p className="lp-label dark"><i />Why TapTab</p>
        <ScrollWords text="Your guests are already holding the best menu, the fastest server bell and your loudest marketing channel. TapTab puts all three behind a single tap, at the table, the counter or the food truck window." />
      </section>

      <Chapters />

      <section id="dashboard" className="lp-dash">
        <div className="lp-dash-copy">
          <p className="lp-label dark"><i />Your side of the tap</p>
          <h2 className="lp-h2">Run it all from one dashboard.</h2>
          <dl className="lp-feats">
            <div><dt>Live requests</dt><dd>A host-stand screen that chimes and turns amber, then red, the longer a table waits.</dd></div>
            <div><dt>Menu in minutes</dt><dd>Upload a menu photo, check the result, translate to Spanish with one click.</dd></div>
            <div><dt>Notes and rewards</dt><dd>Read private feedback before it becomes a review, and see who your regulars are.</dd></div>
            <div><dt>Analytics</dt><dd>Taps by hour, what guests open, and how many reached your Google page.</dd></div>
          </dl>
        </div>
        <div className="lp-board" aria-hidden>
          <div className="lp-board-head"><b>2 tables waiting</b><span><i className="live" />Live</span></div>
          <div className="lp-req late"><span className="t"><small>Table</small>12</span><span className="w"><b>🧾 Wants the check</b><small>7 min</small></span><span className="d">Done</span></div>
          <div className="lp-req warn"><span className="t"><small>Table</small>5</span><span className="w"><b>🥤 Drink refill</b><small>4 min</small></span><span className="d">Done</span></div>
          <div className="lp-req"><span className="t"><small>Table</small>3</span><span className="w"><b>🙋 Needs help</b><small>just now</small></span><span className="d">Done</span></div>
        </div>
      </section>

      <section className="lp-venues" aria-label="Who TapTab is for">
        <div className="lp-marquee">
          {[0, 1].map((k) => (
            <div key={k} className="lp-marquee-row" aria-hidden={k === 1}>
              {VENUES.map((v) => <span key={v}>{v}</span>)}
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="lp-pricing">
        <div className="lp-pricing-head">
          <p className="lp-label dark"><i />Pricing</p>
          <h2 className="lp-h2">Simple monthly plans.</h2>
          <p className="lp-muted">One-time $49 activation. Stands are quoted for your space, and you can cancel any time.</p>
        </div>
        <div className="lp-plans">
          {PLANS.map((p) => (
            <article key={p.name} className={`lp-plan${p.featured ? " featured" : ""}`}>
              <header>
                <h3>{p.name}</h3>
                <p className="lp-price"><b>${p.price}</b> per month</p>
                <p className="lp-muted">{p.line}</p>
              </header>
              <ul>{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
              <a href="#demo" className={`lp-btn${p.featured ? " gold" : " line"}`}>Book a demo</a>
            </article>
          ))}
        </div>
      </section>

      <section id="demo" className="lp-demo">
        <div className="lp-demo-copy">
          <p className="lp-label"><i />Book a demo</p>
          <h2 className="lp-demo-title">Your first tap is on us.</h2>
          <p>We’ll load your menu, bring a stand to your table and show your team the dashboard. It takes about twenty minutes.</p>
        </div>
        <DemoForm />
      </section>

      <footer className="lp-foot">
        <span className="lp-brand small"><img src="/brand/taptab-icon.png" alt="" width={24} height={22} /><span>TapTab</span></span>
        <span>Made in Houston, Texas</span>
        <a href="/login">Restaurant sign in</a>
        <span>© {new Date().getFullYear()} TapTab</span>
      </footer>
    </div>
  );
}
