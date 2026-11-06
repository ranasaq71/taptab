"use client";
import { useActionState, useState } from "react";
import { saveHub, uploadLogo, removeLogo } from "./actions";

const SWATCHES = ["#6E1532", "#1F4D36", "#1E3A6B", "#8A4B12", "#2F2A28", "#5B2A86"];
const BUTTON_LABELS: Record<string, string> = { menu: "Menu", server: "Call your server", wifi: "Wi‑Fi", review: "Leave a review", loyalty: "Rewards card", instagram: "Instagram", tiktok: "TikTok" };

export type HubValues = {
  name: string; tagline: string; brand_color: string; logo_url: string | null;
  special: string; special_es: string; wifi_name: string; wifi_password: string;
  google_review_url: string; instagram_url: string; tiktok_url: string; loyalty_goal: number; loyalty_reward: string;
  buttons: Record<string, boolean>;
  theme: "light" | "dark";
};

export default function HubForm({ v, previewUrl }: { v: HubValues; previewUrl: string | null }) {
  const [state, action, pending] = useActionState(saveHub, {});
  const [logoState, logoAction, logoPending] = useActionState(uploadLogo, {});
  const [color, setColor] = useState(v.brand_color);
  const [theme, setTheme] = useState(v.theme);

  return (
    <div className="hub-editor">
      <section className="card">
        <h2>Logo</h2>
        <div className="logo-row">
          {v.logo_url ? <img src={v.logo_url} alt="Current logo" className="logo-preview" /> : <div className="logo-preview empty">No logo</div>}
          <form action={logoAction} className="logo-form">
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
            <button className="btn" disabled={logoPending}>{logoPending ? "Uploading…" : "Upload"}</button>
          </form>
          {v.logo_url && <form action={removeLogo}><button className="link-btn">Remove</button></form>}
        </div>
        <p className="muted small">Square PNG, JPG or WebP, up to 2 MB.</p>
        {logoState.error && <p className="error">{logoState.error}</p>}
        {logoState.message && <p className="notice">{logoState.message}</p>}
      </section>

      <form action={action}>
        <section className="card">
          <h2>Layout</h2>
          <p className="muted small">How the page looks on guests’ phones. Your brand color is used in both.</p>
          <div className="layout-pick" role="radiogroup" aria-label="Layout">
            {(["light", "dark"] as const).map((t) => (
              <label key={t} className={`layout-opt${theme === t ? " on" : ""}`}>
                <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => setTheme(t)} />
                <span className={`mini mini-${t}`} style={{ ["--brand" as string]: color }} aria-hidden>
                  <span className="mini-top"><i /><i className="mini-pill" /></span>
                  <span className="mini-hero" />
                  <span className="mini-menu" />
                  <span className="mini-tiles"><i /><i /><i /><i /></span>
                </span>
                <b>{t === "light" ? "Light" : "Dark"}</b>
                <small>{t === "light" ? "Bright and clean. Great for daytime and cafés." : "Rich and premium. Great for evening dining and bars."}</small>
              </label>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Restaurant</h2>
          <div className="grid-2">
            <label className="field"><span>Name</span><input name="name" defaultValue={v.name} required /></label>
            <label className="field"><span>Tagline</span><input name="tagline" defaultValue={v.tagline} placeholder="Indo‑Tex comfort food in Sugar Land" /></label>
          </div>
          <div className="field"><span>Brand color</span>
            <div className="swatch-row">
              {SWATCHES.map((c) => (
                <button type="button" key={c} className="sw" style={{ background: c }} aria-label={`Use ${c}`} aria-pressed={color.toLowerCase() === c.toLowerCase()} onClick={() => setColor(c)} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom color" />
              <input name="brand_color" value={color} onChange={(e) => setColor(e.target.value)} className="hex" />
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Today’s special</h2>
          <div className="grid-2">
            <label className="field"><span>English</span><input name="special" defaultValue={v.special} placeholder="Half off mango lassi until 6 pm" /></label>
            <label className="field"><span>Spanish (optional)</span><input name="special_es" defaultValue={v.special_es} placeholder="Lassi de mango a mitad de precio" /></label>
          </div>
          <p className="muted small">Leave both empty to hide the special.</p>
        </section>

        <section className="card">
          <h2>Wi‑Fi &amp; links</h2>
          <div className="grid-2">
            <label className="field"><span>Wi‑Fi network</span><input name="wifi_name" defaultValue={v.wifi_name} autoComplete="off" /></label>
            <label className="field"><span>Wi‑Fi password</span><input name="wifi_password" defaultValue={v.wifi_password} autoComplete="off" /></label>
            <label className="field"><span>Google review link</span><input name="google_review_url" type="url" defaultValue={v.google_review_url} placeholder="https://g.page/r/…/review" /></label>
            <label className="field"><span>Instagram</span><input name="instagram_url" type="url" defaultValue={v.instagram_url} placeholder="https://instagram.com/yourrestaurant" /></label>
            <label className="field"><span>TikTok</span><input name="tiktok_url" type="url" defaultValue={v.tiktok_url} placeholder="https://www.tiktok.com/@yourrestaurant" /></label>
          </div>
          <p className="muted small">Find your Google review link in Google Business Profile → “Ask for reviews”.</p>
        </section>

        <section className="card">
          <h2>Buttons guests see</h2>
          <div className="toggles">
            {Object.keys(BUTTON_LABELS).map((k) => (
              <label key={k}><input type="checkbox" name={`btn_${k}`} defaultChecked={v.buttons[k] ?? true} /> {BUTTON_LABELS[k]}</label>
            ))}
          </div>
          <p className="muted small">Wi‑Fi, Instagram and TikTok only appear when filled in above.</p>
        </section>

        <section className="card">
          <h2>Rewards card</h2>
          <div className="grid-2">
            <label className="field"><span>Stamps needed</span><input name="loyalty_goal" type="number" min={3} max={20} defaultValue={v.loyalty_goal} /></label>
            <label className="field"><span>Reward</span><input name="loyalty_reward" defaultValue={v.loyalty_reward} /></label>
          </div>
        </section>

        <div className="save-bar">
          <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
          {previewUrl && <a href={previewUrl} target="_blank" rel="noopener">Preview on a table ↗</a>}
          {state.error && <span className="error" role="alert">{state.error}</span>}
          {state.message && <span className="notice inline">{state.message}</span>}
        </div>
      </form>
    </div>
  );
}
