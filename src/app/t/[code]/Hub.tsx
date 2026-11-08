"use client";
import { useEffect, useMemo, useState } from "react";
import type { HubButton, HubData, Lang, Localized } from "@/lib/hub";

const T = {
  en: { table: "Table", special: "Today’s Special", close: "Close", all: "All Dishes", menuTitle: "Menu", network: "Network", password: "Password", copy: "Copy password", copied: "Password copied",
        how: "How was everything today?", google: "Post your review on Google", notePrompt: "Anything the manager should know? Only they will see this.",
        notePh: "Type a note", sendNote: "Send to the manager", noteSent: "Sent to the manager. Thank you.",
        serverIntro: "Your server gets an alert right away.", help: "I need help", check: "Bring the check", refill: "Refill our drinks", notified: "Your server has been notified",
        loyaltyIntro: (g: number, r: string) => `Collect ${g} stamps: ${r}.`, phone: "Mobile number", consent: "Save my rewards card to this number. No spam.",
        stamp: "Collect today’s stamp", ready: "Reward ready! Show this screen to your server:", stamped: "Today’s stamp collected", already: "You already collected today’s stamp. See you next visit!", needPhone: "Enter your 10-digit mobile number.", needConsent: "Tick the box above to save your card.", welcome: "Welcome back! Card for", notYou: "Not you?", reward: "Reward unlocked:",
        pdf: "View full menu (PDF)", error: "Something went wrong. Please ask your server.", powered: "Powered by" },
  es: { table: "Mesa", special: "Especial de hoy", close: "Cerrar", all: "Todos", menuTitle: "Menú", network: "Red", password: "Contraseña", copy: "Copiar contraseña", copied: "Contraseña copiada",
        how: "¿Cómo estuvo todo hoy?", google: "Publicar en Google", notePrompt: "¿Algo que el gerente deba saber? Solo lo verá el gerente.",
        notePh: "Escribe aquí", sendNote: "Enviar al gerente", noteSent: "Enviado. Gracias.",
        serverIntro: "Tu mesero recibirá una alerta.", help: "Necesito ayuda", check: "Traer la cuenta", refill: "Rellenar bebidas", notified: "Tu mesero ya va en camino",
        loyaltyIntro: (g: number, r: string) => `Junta ${g} sellos: ${r}.`, phone: "Número de celular", consent: "Guardar mi tarjeta con este número. Sin spam.",
        stamp: "Recibir el sello de hoy", ready: "¡Premio listo! Muestra esta pantalla a tu mesero:", stamped: "Sello de hoy recibido", already: "Ya recibiste el sello de hoy. ¡Hasta tu próxima visita!", needPhone: "Escribe tu número de 10 dígitos.", needConsent: "Marca la casilla para guardar tu tarjeta.", welcome: "¡Bienvenido de nuevo! Tarjeta de", notYou: "¿No eres tú?", reward: "Premio desbloqueado:",
        pdf: "Ver menú completo (PDF)", error: "Algo salió mal. Pide ayuda a tu mesero.", powered: "Con tecnología de" },
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

  const special = L(data.settings.special);
  return (
    <div className="hub" data-hub-theme={data.settings.theme} style={{ ["--brand" as string]: data.location.brandColor }}>
      <header className="hub-top">
        <span className="tt-brand"><img src="/brand/taptab-icon.png" alt="" width={40} height={37} /><span className="tt-word">TapTab</span></span>
        {data.settings.languages.includes("es") && (
          <div className="lang" role="group" aria-label="Language">
            {(["en", "es"] as Lang[]).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        )}
      </header>

      <section className="hub-rest">
        <div className="rest-id">
          {data.location.logoUrl
            ? <img src={data.location.logoUrl} alt="" className="rest-logo" />
            : <span className="rest-logo mono" aria-hidden>{data.location.name.trim().charAt(0).toUpperCase()}</span>}
          <div className="rest-name">
            <h1>{data.location.name}</h1>
            {data.location.tagline && <p>{data.location.tagline}</p>}
          </div>
        </div>
        <span className="tbl-pill"><Icon name="table" />{t.table} {data.table.label}</span>
      </section>

      {special && (
        <section className="special">
          <span className="special-lbl"><span aria-hidden>✦</span> {t.special}</span>
          <p>{special}</p>
          <Swoosh />
        </section>
      )}

      <nav className="hub-actions">
        {buttons.includes("menu") && (
          <button className="menu-card" onClick={() => open("menu")}>
            <span className="menu-ico"><Icon name="menu" /></span>
            <span className="menu-txt"><b>{LABELS.menu[lang][0]}</b><small>{LABELS.menu[lang][1]}</small></span>
            <span className="chev-dot"><Icon name="chevron" /></span>
            <Swoosh />
          </button>
        )}
        <div className="tiles">
          {rest.map((k) => <ActionButton key={k} k={k} lang={lang} onClick={() => open(k)} />)}
        </div>
      </nav>
      <footer className="hub-foot"><span className="rule" />{t.powered} <b>TapTab</b><span className="rule" /></footer>

      {sheet && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className={`sheet-panel${sheet === "menu" ? " menu-panel" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            {sheet === "menu" ? (
              <MenuSheet data={data} L={L} t={t} onClose={() => setSheet(null)} />
            ) : (
              <div className="sheet-top">
                <h2 id="sheet-title">{LABELS[sheet][lang][0]}</h2>
                <button className="x" onClick={() => setSheet(null)} aria-label={t.close}>✕</button>
              </div>
            )}
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

function ActionButton({ k, lang, onClick }: { k: HubButton; lang: Lang; onClick: () => void }) {
  const [title, sub] = LABELS[k][lang];
  return (
    <button className="tile" onClick={onClick}>
      <span className="tile-ico"><Icon name={k} /></span>
      <span className="tile-txt"><b>{title}</b><small>{sub}</small></span>
      <span className="tile-chev"><Icon name="chevron" /></span>
    </button>
  );
}

/** Line icons drawn to match the TapTab design. */
function Icon({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    menu: <><path d="M2.5 5.2c2.8-1.1 6-1 9.5 1 3.5-2 6.7-2.1 9.5-1V19c-2.8-1.1-6-1-9.5 1-3.5-2-6.7-2.1-9.5-1Z" /><path d="M12 6.2V20" /><path d="M6.2 8.2v2.6a1.1 1.1 0 0 0 2.2 0V8.2M7.3 11.9v4.6" /><path d="M17.2 8.2c-1.2 1-1.4 3-1 4.6h1v3.7" /></>,
    server: <><path d="M4.5 17a7.5 7.5 0 0 1 15 0" /><path d="M3 17.2h18" /><path d="M12 9.5V8" /><circle cx="12" cy="7" r="1" /><path d="M17.3 4.8l.9-1.4M19.6 7.2l1.5-.6" /></>,
    wifi: <><path d="M2.5 9.2a14 14 0 0 1 19 0" /><path d="M5.6 12.6a9.4 9.4 0 0 1 12.8 0" /><path d="M8.7 16a4.8 4.8 0 0 1 6.6 0" /><circle cx="12" cy="19.2" r="1.1" fill="currentColor" stroke="none" /></>,
    review: <path d="m12 3.2 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9Z" />,
    loyalty: <><rect x="3" y="5" width="18" height="14" rx="2.6" /><path d="M3 9.2h18" /><path d="m12 11.4.85 1.7 1.9.3-1.37 1.33.32 1.87-1.7-.9-1.7.9.32-1.87-1.37-1.33 1.9-.3Z" /></>,
    instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></>,
    tiktok: <><path d="M13.8 3v11.6a3.6 3.6 0 1 1-3.6-3.6" /><path d="M13.8 3c.4 2.7 2.3 4.5 5.2 4.7" /></>,
    table: <><path d="M3 8.5h18" /><path d="M5.5 8.5V18M18.5 8.5V18" /><path d="M8 8.5v3.5h8V8.5" /></>,
    chevron: <path d="m9.5 6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...p}>{paths[name]}</svg>;
}

/** Gold accent curve used on the special banner and menu card. */
function Swoosh() {
  return (
    <svg className="swoosh" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden>
      <path d="M0 58 C 90 50, 190 30, 300 4 V60 H0 Z" fill="currentColor" opacity=".14" />
      <path d="M40 57 C 130 50, 215 32, 300 10" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function MenuSheet({ data, L, t, onClose }: { data: HubData; L: (o?: Localized) => string; t: typeof T.en; onClose: () => void }) {
  const [filter, setFilter] = useState("all");
  const isSpicy = (i: { heat: number; tags: string[] }) => i.heat > 0 || i.tags.includes("hot");
  const match = (i: HubData["menu"]["categories"][number]["items"][number]) =>
    filter === "all" || (filter === "hot" ? isSpicy(i) : i.tags.includes(filter));
  const all = data.menu.categories.flatMap((c) => c.items);
  const filters = ["all", "hot", "veg", "gf"].filter((f) => f === "all" || all.some((i) => (f === "hot" ? isSpicy(i) : i.tags.includes(f))));
  const chipIcon: Record<string, string> = { all: "cutlery", hot: "flame", veg: "leaf", gf: "wheat" };
  const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

  return (
    <>
      <header className="mh">
        <h2 id="sheet-title" className="mh-title">{t.menuTitle}</h2>
        <button className="x" onClick={onClose} aria-label={t.close}>✕</button>
      </header>
      {filters.length > 1 && (
        <div className="mchips" role="group">
          {filters.map((f) => (
            <button key={f} className="mchip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              <MIcon name={chipIcon[f]} />{f === "all" ? t.all : L(TAGS[f])}
            </button>
          ))}
        </div>
      )}
      {data.menu.categories.map((c) => {
        const items = c.items.filter(match);
        if (!items.length) return null;
        return (
          <section key={c.id} className="mcat">
            <header className="mcat-band">
              <span className="mcat-leaf"><MIcon name="leafmark" /></span>
              <h3>{L(c.name)}</h3>
              <span className="mcat-rule" />
              {L(c.subtitle) && <em>{L(c.subtitle)}</em>}
            </header>
            {c.display === "cards" ? (
              <div className="mcards">
                {items.map((i) => (
                  <div className="mcard" key={i.id}>
                    {i.photoUrl ? <img src={i.photoUrl} alt="" loading="lazy" /> : <span className="mcard-ph"><MIcon name="leafmark" /></span>}
                    <b>{L(i.name)}</b>
                    {L(i.description) && <small>{L(i.description)}</small>}
                    <Heat n={i.heat} scale />
                    {i.priceCents != null && <span className="mprice sm">{money(i.priceCents)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mlist">
                {items.map((i) => (
                  <div className={`mrow${i.photoUrl ? "" : " nophoto"}`} key={i.id}>
                    {i.photoUrl && <img src={i.photoUrl} alt="" loading="lazy" className="mrow-photo" />}
                    <div className="mrow-main">
                      <b>{L(i.name)} <Heat n={i.heat} /></b>
                      {L(i.description) && <small>{L(i.description)}</small>}
                      {i.tags.some((x) => x === "veg" || x === "vegan" || x === "gf") && (
                        <div className="tags">{i.tags.filter((x) => x !== "hot" && TAGS[x]).map((x) => <span key={x} className="tag">{L(TAGS[x])}</span>)}</div>
                      )}
                    </div>
                    {i.priceCents != null && <span className="mprice">{money(i.priceCents)}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {data.menu.pdfUrl && <a className="big-btn ghost" href={data.menu.pdfUrl} target="_blank" rel="noopener">{t.pdf}</a>}
    </>
  );
}

/** Flames: in a dish row, one flame per heat level; on a card, a 3-flame scale. */
function Heat({ n, scale }: { n: number; scale?: boolean }) {
  if (!scale && n <= 0) return null;
  const count = scale ? 3 : n;
  return (
    <span className={`heat${scale ? " scale" : ""}`} aria-label={n > 0 ? `Spice level ${n} of 3` : "Not spicy"}>
      {Array.from({ length: count }, (_, k) => <MIcon key={k} name="flame" className={k < n ? "on" : "off"} />)}
    </span>
  );
}

function MIcon({ name, className }: { name: string; className?: string }) {
  if (name === "flame") return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden className={`flame ${className ?? ""}`}>
      <path fill="currentColor" d="M12.6 2.3c.4 2.6-.6 4.3-2 5.9-1.5 1.7-3.4 3.4-3.4 6.6A4.8 4.8 0 0 0 12 19.7a4.8 4.8 0 0 0 4.8-4.9c0-1.6-.6-2.9-1.3-4 .1 1.2-.3 2.3-1.2 2.9.3-2.6-.2-5.4-1.7-7.6-.5-.8-.6-2.3 0-3.8Z" />
      <path fill="#FFD27A" opacity=".85" d="M12.2 12.4c.2 1.4-.4 2.2-1 3-.5.6-.9 1.2-.9 2a1.8 1.8 0 0 0 3.6.1c0-.9-.4-1.5-.9-2.1.1.4 0 .8-.3 1 .1-1.3-.1-2.7-.5-4Z" />
    </svg>
  );
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const d: Record<string, React.ReactNode> = {
    cutlery: <><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" /><path d="M17 3c-2 1.5-2.5 5-1.5 8H17v10" /></>,
    leaf: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" /><path d="M5 19 13 11" /></>,
    wheat: <><path d="M12 21V8" /><path d="M12 12c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Zm0 0c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Zm0-4c-2 0-3-1.3-3-3.5 2 0 3 1.3 3 3.5Zm0 0c2 0 3-1.3 3-3.5-2 0-3 1.3-3 3.5Z" /></>,
    leafmark: <><path d="M3 15c4-9 11-11 18-10-2 7-7 12-15 12" /><path d="M7 15c3-3 6-5 10-6" /><path d="M5 19c3-1 5-2 7-4" /></>,
  };
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...p}>{d[name]}</svg>;
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
  // The guest's number and last stamp count are remembered on their own phone only.
  const key = `taptab-card-${data.location.id}`;
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [state, setState] = useState<{ stamps: number; done: boolean; available?: number; rewardText?: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const stamps = state?.stamps ?? 0;

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? "null");
      if (c?.phone) { setPhone(c.phone); setConsent(true); setSaved(c.phone); setState({ stamps: c.stamps ?? 0, done: false, available: c.available }); }
    } catch {}
  }, [key]);

  async function collect() {
    if (phone.replace(/\D/g, "").length < 10) { setProblem(t.needPhone); return; }
    if (!consent) { setProblem(t.needConsent); return; }
    setProblem(""); setBusy(true);
    try {
      const r = await send({ action: "stamp", phone, consent: true });
      setState({ stamps: r.stamps, done: true, available: r.available, rewardText: r.rewardText, note: r.alreadyStamped ? t.already : undefined });
      try { localStorage.setItem(key, JSON.stringify({ phone, stamps: r.stamps, available: r.available })); setSaved(phone); } catch {}
      onToast(r.reward ? `${t.reward} ${r.rewardText}` : r.alreadyStamped ? t.already : t.stamped);
    } catch (e: any) { setProblem(e.message); } finally { setBusy(false); }
  }
  function forget() {
    try { localStorage.removeItem(key); } catch {}
    setSaved(null); setPhone(""); setConsent(false); setState(null); setProblem("");
  }
  const last4 = saved ? saved.replace(/\D/g, "").slice(-4) : "";

  return (
    <>
      <p className="muted">{t.loyaltyIntro(goal, data.settings.loyaltyReward)}</p>
      {saved && <p className="welcome-back">{t.welcome} •••{last4} · <button className="link-btn" onClick={forget}>{t.notYou}</button></p>}
      {!!state?.available && state.available > 0 && (
        <div className="reward-ready" role="status">🎉 {t.ready} <b>{state.rewardText ?? data.settings.loyaltyReward}</b>{state.available > 1 ? ` (×${state.available})` : ""}</div>
      )}
      <div className="stamps" style={{ gridTemplateColumns: `repeat(${Math.min(goal, 5)}, 1fr)` }}>
        {Array.from({ length: goal }, (_, i) => <div key={i} className={`stamp${i < stamps ? " on" : ""}`}>{i < stamps ? "✓" : ""}</div>)}
      </div>
      {state?.done ? (
        state.note && <p className="muted center">{state.note}</p>
      ) : (
        <>
          {!saved && (
            <>
              <label className="field"><span>{t.phone}</span><input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setProblem(""); }} placeholder="(281) 555-0101" /></label>
              <label className="check"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setProblem(""); }} /> {t.consent}</label>
            </>
          )}
          <button className="big-btn" disabled={busy} onClick={collect}>{busy ? "…" : t.stamp}</button>
          {problem && <p className="error center" role="alert">{problem}</p>}
        </>
      )}
    </>
  );
}
