"use client";
import { useEffect, useMemo, useState } from "react";
import type { HubButton, HubData, Lang, Localized } from "@/lib/hub";

const T = {
  en: { table: "Table", special: "Today’s special", close: "Close", all: "All", network: "Network", password: "Password", copy: "Copy password", copied: "Password copied",
        how: "How was everything today?", google: "Post your review on Google", notePrompt: "Anything the manager should know? Only they will see this.",
        notePh: "Type a note", sendNote: "Send to the manager", noteSent: "Sent to the manager. Thank you.",
        serverIntro: "Your server gets an alert right away.", help: "I need help", check: "Bring the check", refill: "Refill our drinks", notified: "Your server has been notified",
        loyaltyIntro: (g: number, r: string) => `Collect ${g} stamps: ${r}.`, phone: "Mobile number", consent: "Save my rewards card to this number. No spam.",
        stamp: "Collect today’s stamp", stamped: "Today’s stamp collected", already: "You already collected a stamp today", reward: "Reward unlocked:",
        pdf: "View full menu (PDF)", error: "Something went wrong. Please ask your server.", powered: "Powered by TapTab" },
  es: { table: "Mesa", special: "Especial de hoy", close: "Cerrar", all: "Todo", network: "Red", password: "Contraseña", copy: "Copiar contraseña", copied: "Contraseña copiada",
        how: "¿Cómo estuvo todo hoy?", google: "Publicar en Google", notePrompt: "¿Algo que el gerente deba saber? Solo lo verá el gerente.",
        notePh: "Escribe aquí", sendNote: "Enviar al gerente", noteSent: "Enviado. Gracias.",
        serverIntro: "Tu mesero recibirá una alerta.", help: "Necesito ayuda", check: "Traer la cuenta", refill: "Rellenar bebidas", notified: "Tu mesero ya va en camino",
        loyaltyIntro: (g: number, r: string) => `Junta ${g} sellos: ${r}.`, phone: "Número de celular", consent: "Guardar mi tarjeta con este número. Sin spam.",
        stamp: "Recibir el sello de hoy", stamped: "Sello de hoy recibido", already: "Ya recibiste el sello de hoy", reward: "Premio desbloqueado:",
        pdf: "Ver menú completo (PDF)", error: "Algo salió mal. Pide ayuda a tu mesero.", powered: "Con tecnología de TapTab" },
};
const LABELS: Record<HubButton, { ico: string; en: [string, string]; es: [string, string] }> = {
  menu:      { ico: "📖", en: ["Menu", "Browse dishes"], es: ["Menú", "Ver platillos"] },
  server:    { ico: "🙋", en: ["Call your server", "Help, check or refill"], es: ["Llamar al mesero", "Ayuda, cuenta o rellenar"] },
  wifi:      { ico: "📶", en: ["Wi‑Fi", "Get the password"], es: ["Wi‑Fi", "Ver contraseña"] },
  review:    { ico: "⭐", en: ["Leave a review", "Tell us how it went"], es: ["Dejar reseña", "Cuéntanos"] },
  loyalty:   { ico: "🎟️", en: ["Rewards card", "Collect a stamp"], es: ["Tarjeta de premios", "Gana un sello"] },
  instagram: { ico: "📸", en: ["Instagram", "Follow us"], es: ["Instagram", "Síguenos"] },
  tiktok:    { ico: "🎵", en: ["TikTok", "Watch our videos"], es: ["TikTok", "Mira nuestros videos"] },
};
const ORDER: HubButton[] = ["menu", "server", "wifi", "review", "loyalty", "instagram", "tiktok"];
const TAGS: Record<string, Localized> = { veg: { en: "Vegetarian", es: "Vegetariano" }, vegan: { en: "Vegan", es: "Vegano" }, gf: { en: "Gluten‑free", es: "Sin gluten" }, hot: { en: "Spicy", es: "Picante" } };

type Sheet = null | "menu" | "wifi" | "review" | "server" | "loyalty";

export default function Hub({ data }: { data: HubData }) {
  const [lang, setLang] = useState<Lang>("en");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const t = T[lang];
  const L = (o: Localized | undefined) => (o?.[lang] || o?.en || "");
  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 12), []);

  useEffect(() => {
    const browser = (navigator.language || "en").slice(0, 2) as Lang;
    if (browser === "es" && data.settings.languages.includes("es")) setLang("es");
  }, [data.settings.languages]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2400); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);

  async function send(body: Record<string, unknown>) {
    const res = await fetch("/api/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: data.tagCode, sessionId, ...body }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || t.error);
    return json;
  }
  const track = (type: string) => { send({ action: "event", type }).catch(() => {}); };

  const buttons = ORDER.filter((k) => data.settings.buttons[k] && (k !== "instagram" || data.settings.instagramUrl) && (k !== "tiktok" || data.settings.tiktokUrl) && (k !== "wifi" || data.settings.wifiName));
  const rest = buttons.filter((k) => k !== "menu");

  function open(k: HubButton) {
    track(k);
    if (k === "instagram") { window.open(data.settings.instagramUrl!, "_blank", "noopener"); return; }
    if (k === "tiktok") { window.open(data.settings.tiktokUrl!, "_blank", "noopener"); return; }
    setSheet(k);
  }

  return (
    <div className="hub" style={{ ["--brand" as string]: data.location.brandColor }}>
      {data.settings.languages.includes("es") && (
        <div className="lang" role="group" aria-label="Language">
          {(["en", "es"] as Lang[]).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      )}
      <header className="hub-head">
        {data.location.logoUrl && <img src={data.location.logoUrl} alt="" className="logo" />}
        <span className="tbl">{t.table} {data.table.label}</span>
        <h1>{data.location.name}</h1>
        {data.location.tagline && <p>{data.location.tagline}</p>}
      </header>
      {L(data.settings.special) && <div className="special"><b>{t.special}</b>{L(data.settings.special)}</div>}

      <nav className="hub-actions">
        {buttons.includes("menu") && <ActionButton k="menu" lang={lang} wide primary onClick={() => open("menu")} />}
        {rest.map((k, i) => <ActionButton key={k} k={k} lang={lang} wide={rest.length % 2 === 1 && i === rest.length - 1} onClick={() => open(k)} />)}
      </nav>
      <footer className="hub-foot">{t.powered}</footer>

      {sheet && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <div className="sheet-top">
              <h2 id="sheet-title">{LABELS[sheet][lang][0]}</h2>
              <button className="x" onClick={() => setSheet(null)} aria-label={t.close}>✕</button>
            </div>
            {sheet === "menu" && <MenuSheet data={data} lang={lang} L={L} t={t} />}
            {sheet === "wifi" && (
              <>
                <div className="wifi-box"><div><span>{t.network}</span><b>{data.settings.wifiName}</b></div><div><span>{t.password}</span><b>{data.settings.wifiPassword}</b></div></div>
                <button className="big-btn" onClick={() => { navigator.clipboard?.writeText(data.settings.wifiPassword ?? "").catch(() => {}); setToast(t.copied); }}>{t.copy}</button>
              </>
            )}
            {sheet === "review" && <ReviewSheet data={data} t={t} send={send} track={track} done={(m) => { setSheet(null); setToast(m); }} onError={setToast} />}
            {sheet === "server" && (
              <>
                <p className="muted">{t.serverIntro}</p>
                {([["help", "🙋", t.help], ["check", "🧾", t.check], ["refill", "🥤", t.refill]] as const).map(([kind, ico, label]) => (
                  <button key={kind} className="opt" onClick={() => send({ action: "request", kind }).then(() => { setSheet(null); setToast(t.notified); }).catch((e) => setToast(e.message))}>
                    <span className="ico" aria-hidden>{ico}</span><b>{label}</b>
                  </button>
                ))}
              </>
            )}
            {sheet === "loyalty" && <LoyaltySheet data={data} t={t} send={send} onToast={setToast} />}
          </div>
        </div>
      )}
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

function ActionButton({ k, lang, wide, primary, onClick }: { k: HubButton; lang: Lang; wide?: boolean; primary?: boolean; onClick: () => void }) {
  const [title, sub] = LABELS[k][lang];
  return (
    <button className={`act${wide ? " wide" : ""}${primary ? " primary" : ""}`} onClick={onClick}>
      <span className="ico" aria-hidden>{LABELS[k].ico}</span>
      <span><b>{title}</b><br /><small>{sub}</small></span>
    </button>
  );
}

function MenuSheet({ data, lang, L, t }: { data: HubData; lang: Lang; L: (o?: Localized) => string; t: typeof T.en }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "veg", "gf", "hot"].filter((f) => f === "all" || data.menu.categories.some((c) => c.items.some((i) => i.tags.includes(f))));
  return (
    <>
      {filters.length > 1 && (
        <div className="chips" role="group">
          {filters.map((f) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? t.all : L(TAGS[f])}</button>)}
        </div>
      )}
      {data.menu.categories.map((c) => {
        const items = c.items.filter((i) => filter === "all" || i.tags.includes(filter));
        if (!items.length) return null;
        return (
          <section key={c.id}>
            <div className="cat">{L(c.name)}</div>
            {items.map((i) => (
              <div className="item" key={i.id}>
                <div>
                  <b>{L(i.name)}</b>
                  {L(i.description) && <small>{L(i.description)}</small>}
                  {i.tags.length > 0 && <div className="tags">{i.tags.filter((x) => TAGS[x]).map((x) => <span key={x} className={`tag${x === "hot" ? " hot" : ""}`}>{L(TAGS[x])}</span>)}</div>}
                </div>
                {i.priceCents != null && <span className="price">${(i.priceCents / 100).toFixed(i.priceCents % 100 ? 2 : 0)}</span>}
              </div>
            ))}
          </section>
        );
      })}
      {data.menu.pdfUrl && <a className="big-btn ghost" href={data.menu.pdfUrl} target="_blank" rel="noopener">{t.pdf}</a>}
    </>
  );
}

function ReviewSheet({ data, t, send, track, done, onError }: { data: HubData; t: typeof T.en; send: (b: Record<string, unknown>) => Promise<any>; track: (x: string) => void; done: (m: string) => void; onError: (m: string) => void }) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  return (
    <>
      <p className="muted center">{t.how}</p>
      <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= stars ? "on" : ""} onClick={() => setStars(n)} aria-label={`${n}`}>★</button>)}</div>
      {stars > 0 && (
        <>
          {/* Every guest is offered the Google link. Filtering by rating ("review gating") breaks Google's rules. */}
          {data.settings.googleReviewUrl && <a className="big-btn" href={data.settings.googleReviewUrl} target="_blank" rel="noopener" onClick={() => track("google")}>{t.google}</a>}
          <p className="muted">{t.notePrompt}</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePh} maxLength={2000} />
          <button className="big-btn ghost" disabled={!note.trim()} onClick={() => send({ action: "note", stars, body: note }).then(() => done(t.noteSent)).catch((e) => onError(e.message))}>{t.sendNote}</button>
        </>
      )}
    </>
  );
}

function LoyaltySheet({ data, t, send, onToast }: { data: HubData; t: typeof T.en; send: (b: Record<string, unknown>) => Promise<any>; onToast: (m: string) => void }) {
  const goal = data.settings.loyaltyGoal;
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<{ stamps: number; done: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const stamps = state?.stamps ?? 0;
  async function collect() {
    setBusy(true);
    try {
      const r = await send({ action: "stamp", phone, consent: true });
      setState({ stamps: r.stamps, done: true });
      onToast(r.reward ? `${t.reward} ${r.rewardText}` : r.alreadyStamped ? t.already : t.stamped);
    } catch (e: any) { onToast(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <p className="muted">{t.loyaltyIntro(goal, data.settings.loyaltyReward)}</p>
      <div className="stamps" style={{ gridTemplateColumns: `repeat(${Math.min(goal, 5)}, 1fr)` }}>
        {Array.from({ length: goal }, (_, i) => <div key={i} className={`stamp${i < stamps ? " on" : ""}`}>{i < stamps ? "✓" : ""}</div>)}
      </div>
      {!state?.done && (
        <>
          <label className="field"><span>{t.phone}</span><input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(281) 555-0101" /></label>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t.consent}</label>
          <button className="big-btn" disabled={!consent || phone.replace(/\D/g, "").length < 10 || busy} onClick={collect}>{t.stamp}</button>
        </>
      )}
    </>
  );
}
