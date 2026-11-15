"use client";
import { useState, useTransition } from "react";
import * as A from "./actions";
import { shrinkImage } from "./shrink";
import { ruleText, type ModGroup } from "@/lib/modifiers";

type L = { en?: string; es?: string };
export type MItem = { id: string; name: L; description: L; priceCents: number | null; tags: string[]; photoUrl: string | null; available: boolean; heat: number; modifiers: ModGroup[] };
export type MCat = { id: string; name: L; subtitle: L; display: "list" | "cards"; items: MItem[] };
const TAG_LABEL: Record<string, string> = { veg: "Vegetarian", vegan: "Vegan", gf: "Gluten‑free", hot: "Spicy" };
const DIET = ["veg", "vegan", "gf"] as const;
const HEAT = ["Not spicy", "Mild", "Medium", "Hot"];
const flames = (n: number) => (n > 0 ? " " + "🔥".repeat(n) : "");

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  const run = (fn: () => Promise<A.Result>) => start(async () => { const r = await fn(); setMsg({ error: r.error, message: r.message }); });
  return { pending, msg, run, setMsg };
}
const Msg = ({ m }: { m: { error?: string; message?: string } }) =>
  m.error ? <p className="error" role="alert">{m.error}</p> : m.message ? <p className="notice">{m.message}</p> : null;

export default function MenuEditor({ cats, pdfUrl }: { cats: MCat[]; pdfUrl: string | null }) {
  const dishes = cats.reduce((n, c) => n + c.items.length, 0);
  return (
    <>
      <AiImport hasMenu={dishes > 0} />
      <div className="menu-tools">
        <Translate disabled={!dishes} />
        <PdfMenu url={pdfUrl} />
      </div>
      {cats.map((c, i) => <Category key={c.id} c={c} first={i === 0} last={i === cats.length - 1} />)}
      <AddCategory />
    </>
  );
}

// ---------- AI import ----------
function AiImport({ hasMenu }: { hasMenu: boolean }) {
  const [draft, setDraft] = useState<A.Draft | null>(null);
  const { pending, msg, run, setMsg } = useAct();
  const [reading, setReading] = useState(false);

  async function read(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setReading(true); setMsg({}); setDraft(null);
    const fd = new FormData();
    fd.append("file", await shrinkImage(file, 2400, 0.85));
    const r = await A.aiReadMenu(fd);
    setReading(false);
    setMsg({ error: r.error, message: r.message });
    if (r.draft) setDraft(r.draft);
  }

  return (
    <section className="card ai-card">
      <h2>✨ Import your menu with AI</h2>
      <p className="muted small">Upload a clear photo or PDF of the menu. TapTab reads the dishes, prices and sections for you to check before anything is saved. Diet labels are only added where the menu itself shows them.</p>
      <form onSubmit={read} className="logo-form">
        <input type="file" name="file" accept="image/*,application/pdf" required />
        <button className="btn" disabled={reading}>{reading ? "Reading the menu… (up to a minute)" : "Read menu"}</button>
      </form>
      <Msg m={msg} />
      {draft && (
        <div className="draft">
          {draft.categories.map((c, ci) => (
            <div key={ci} className="draft-cat">
              <h3>{c.name}</h3>
              <ul>{c.items.map((i, ii) => (
                <li key={ii}><span><b>{i.name}</b>{i.description ? <small> · {i.description}</small> : null}{(i.tags ?? []).map((t) => <span key={t} className="tag">{TAG_LABEL[t] ?? t}</span>)}</span><span>{i.price != null ? `$${i.price.toFixed(2)}` : "-"}</span></li>
              ))}</ul>
            </div>
          ))}
          <div className="save-bar">
            <button className="btn" disabled={pending} onClick={() => run(async () => { const r = await A.aiSaveDraft(draft, "add"); if (r.ok) setDraft(null); return r; })}>{hasMenu ? "Add to my menu" : "Save as my menu"}</button>
            {hasMenu && <button className="btn-sm" disabled={pending} onClick={() => { if (confirm("Replace your whole current menu with this one?")) run(async () => { const r = await A.aiSaveDraft(draft, "replace"); if (r.ok) setDraft(null); return r; }); }}>Replace my menu</button>}
            <button className="link-btn" onClick={() => { setDraft(null); setMsg({}); }}>Discard</button>
            <span className="muted small">You can fix anything after saving.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Translate({ disabled }: { disabled: boolean }) {
  const { pending, msg, run } = useAct();
  return (
    <section className="card">
      <h2>🌎 Spanish menu</h2>
      <p className="muted small">Fills in Spanish for every section, dish and description that doesn’t have it yet.</p>
      <div className="row-gap">
        <button className="btn" disabled={disabled || pending} onClick={() => run(() => A.aiTranslate(false))}>{pending ? "Translating…" : "Translate to Spanish"}</button>
        <button className="link-btn" disabled={disabled || pending} onClick={() => { if (confirm("Re-translate everything, replacing Spanish you’ve edited?")) run(() => A.aiTranslate(true)); }}>Redo all</button>
      </div>
      <Msg m={msg} />
    </section>
  );
}

function PdfMenu({ url }: { url: string | null }) {
  const { pending, msg, run } = useAct();
  return (
    <section className="card">
      <h2>📄 Full menu PDF (optional)</h2>
      <p className="muted small">Shows a “View full menu (PDF)” button under your dishes.</p>
      {url && <p><a href={url} target="_blank" rel="noopener">Current PDF ↗</a> · <button className="link-btn" onClick={() => run(A.removeMenuPdf)}>Remove</button></p>}
      <form className="logo-form" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => A.uploadMenuPdf(fd)); }}>
        <input type="file" name="pdf" accept="application/pdf" required />
        <button className="btn-sm" disabled={pending}>{pending ? "Uploading…" : url ? "Replace PDF" : "Upload PDF"}</button>
      </form>
      <Msg m={msg} />
    </section>
  );
}

// ---------- Categories & dishes ----------
function Category({ c, first, last }: { c: MCat; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pending, msg, run } = useAct();
  return (
    <section className="card">
      <div className="cat-head">
        {editing ? (
          <form className="cat-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const s = (k: string) => String(f.get(k) ?? ""); run(async () => { const r = await A.saveCategory({ id: c.id, en: s("en"), es: s("es"), subEn: s("subEn"), subEs: s("subEs"), display: s("display") as "list" | "cards" }); if (r.ok) setEditing(false); return r; }); }}>
            <input name="en" defaultValue={c.name.en} placeholder="Section (English)" required />
            <input name="es" defaultValue={c.name.es} placeholder="Sección (español)" />
            <input name="subEn" defaultValue={c.subtitle.en} placeholder="Subtitle, e.g. Choose your favorite flavor (optional)" />
            <input name="subEs" defaultValue={c.subtitle.es} placeholder="Subtítulo (optional)" />
            <select name="display" defaultValue={c.display} aria-label="How this section looks">
              <option value="list">Show as a list (dishes with photo and price)</option>
              <option value="cards">Show as cards (flavors, sauces, sides)</option>
            </select>
            <button className="btn-sm" disabled={pending}>Save</button>
            <button type="button" className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <div>
            <h2>{c.name.en}{c.name.es && <span className="muted es"> · {c.name.es}</span>}</h2>
            <p className="muted small cat-meta">{c.display === "cards" ? "Shown as cards" : "Shown as a list"}{c.subtitle.en ? ` · “${c.subtitle.en}”` : ""}</p>
          </div>
        )}
        <div className="row-gap">
          <button className="icon-btn" disabled={first || pending} onClick={() => run(() => A.moveCategory(c.id, -1))} aria-label="Move section up">↑</button>
          <button className="icon-btn" disabled={last || pending} onClick={() => run(() => A.moveCategory(c.id, 1))} aria-label="Move section down">↓</button>
          {!editing && <button className="link-btn" onClick={() => setEditing(true)}>Rename</button>}
          <button className="link-btn danger" onClick={() => { if (confirm(`Delete “${c.name.en}” and its ${c.items.length} dishes?`)) run(() => A.deleteCategory(c.id)); }}>Delete</button>
        </div>
      </div>
      <Msg m={msg} />
      <div className="dishes">
        {c.items.map((i, k) => <Dish key={i.id} item={i} categoryId={c.id} first={k === 0} last={k === c.items.length - 1} />)}
        {!c.items.length && !adding && <p className="muted small">No dishes yet.</p>}
      </div>
      {adding ? <DishForm categoryId={c.id} onDone={() => setAdding(false)} /> : <button className="btn-sm" onClick={() => setAdding(true)}>+ Add dish</button>}
    </section>
  );
}

function Dish({ item, categoryId, first, last }: { item: MItem; categoryId: string; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const { pending, msg, run } = useAct();
  if (editing) return <DishForm item={item} categoryId={categoryId} onDone={() => setEditing(false)} />;
  return (
    <div className={`dish${item.available ? "" : " off"}`}>
      {item.photoUrl ? <img src={item.photoUrl} alt="" className="dish-photo" /> : <div className="dish-photo empty" />}
      <div className="dish-main">
        <b>{item.name.en}{flames(item.heat)}</b>{item.name.es && <span className="muted es"> · {item.name.es}</span>}
        {item.description.en && <small>{item.description.en}</small>}
        {item.modifiers.length > 0 && <small className="mod-sum">{item.modifiers.map((g) => `${g.name.en} (${ruleText(g)}): ${g.options.map((o) => o.name.en + (o.priceCents ? ` +$${(o.priceCents / 100).toFixed(2)}` : "")).join(", ")}`).join(" · ")}</small>}
        <div className="tags">{item.tags.filter((t) => t !== "hot").map((t) => <span key={t} className="tag">{TAG_LABEL[t]}</span>)}{!item.available && <span className="tag off-tag">Sold out / hidden</span>}</div>
        <Msg m={msg} />
      </div>
      <div className="dish-price">{item.priceCents != null ? `$${(item.priceCents / 100).toFixed(2)}` : ""}</div>
      <div className="dish-actions">
        <button className="icon-btn" disabled={first || pending} onClick={() => run(() => A.moveItem(item.id, -1))} aria-label="Move up">↑</button>
        <button className="icon-btn" disabled={last || pending} onClick={() => run(() => A.moveItem(item.id, 1))} aria-label="Move down">↓</button>
        <button className="link-btn" onClick={() => run(() => A.toggleItem(item.id, !item.available))}>{item.available ? "Hide" : "Show"}</button>
        <button className="link-btn" onClick={() => setEditing(true)}>Edit</button>
      </div>
    </div>
  );
}

function DishForm({ item, categoryId, onDone }: { item?: MItem; categoryId: string; onDone: () => void }) {
  const { pending, msg, run } = useAct();
  const photo = useAct();
  const [tags, setTags] = useState<string[]>((item?.tags ?? []).filter((t) => t !== "hot"));
  const [heat, setHeat] = useState<number>(item?.heat ?? 0);
  const [mods, setMods] = useState<ModGroup[]>(item?.modifiers ?? []);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    run(async () => {
      const r = await A.saveItem({ id: item?.id, categoryId, nameEn: s("nameEn"), nameEs: s("nameEs"), descEn: s("descEn"), descEs: s("descEs"), price: s("price").replace("$", ""), tags: tags as any, heat, modifiers: mods, available: f.get("available") === "on" });
      if (r.ok) onDone();
      return r;
    });
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    const fd = new FormData();
    fd.append("itemId", item.id);
    fd.append("photo", await shrinkImage(file, 1200, 0.82));
    photo.run(() => A.uploadItemPhoto(fd));
  }
  return (
    <form className="dish-form" onSubmit={submit}>
      <div className="grid-2">
        <label className="field"><span>Dish name</span><input name="nameEn" defaultValue={item?.name.en} required /></label>
        <label className="field"><span>Name in Spanish (optional)</span><input name="nameEs" defaultValue={item?.name.es} /></label>
        <label className="field"><span>Description</span><input name="descEn" defaultValue={item?.description.en} /></label>
        <label className="field"><span>Description in Spanish (optional)</span><input name="descEs" defaultValue={item?.description.es} /></label>
        <label className="field"><span>Price ($)</span><input name="price" inputMode="decimal" defaultValue={item?.priceCents != null ? (item.priceCents / 100).toFixed(2) : ""} placeholder="12.50" /></label>
        <div className="field"><span>Spice level</span>
          <div className="chips">{HEAT.map((label, n) => (
            <button type="button" key={n} className="chip" aria-pressed={heat === n} onClick={() => setHeat(n)}>{label}{flames(n)}</button>
          ))}</div>
        </div>
        <div className="field"><span>Diet labels</span>
          <div className="chips">{DIET.map((k) => [k, TAG_LABEL[k]] as const).map(([k, label]) => (
            <button type="button" key={k} className="chip" aria-pressed={tags.includes(k)} onClick={() => setTags((t) => t.includes(k) ? t.filter((x) => x !== k) : [...t, k])}>{label}</button>
          ))}</div>
        </div>
      </div>
      <ModsEditor mods={mods} setMods={setMods} />
      <label className="check-row"><input type="checkbox" name="available" defaultChecked={item?.available ?? true} /> Show on the menu</label>
      {item && (
        <div className="row-gap">
          <span className="small">Photo:</span>
          <input type="file" accept="image/*" onChange={upload} disabled={photo.pending} />
          {item.photoUrl && <button type="button" className="link-btn" onClick={() => photo.run(() => A.removeItemPhoto(item.id))}>Remove photo</button>}
          {photo.pending && <span className="muted small">Uploading…</span>}
        </div>
      )}
      {!item && <p className="muted small">Save the dish first, then add a photo.</p>}
      <Msg m={photo.msg} />
      <Msg m={msg} />
      <div className="row-gap">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save dish"}</button>
        <button type="button" className="link-btn" onClick={onDone}>Cancel</button>
        {item && <button type="button" className="link-btn danger" onClick={() => { if (confirm(`Delete “${item.name.en}”?`)) run(async () => { const r = await A.deleteItem(item.id); if (r.ok) onDone(); return r; }); }}>Delete dish</button>}
      </div>
    </form>
  );
}

// ---------- Options & add-ons (modifier groups) ----------
const blankGroup = (): ModGroup => ({ name: { en: "" }, required: true, min: 1, max: 1, options: [{ name: { en: "" }, priceCents: 0 }] });

function ModsEditor({ mods, setMods }: { mods: ModGroup[]; setMods: (m: ModGroup[]) => void }) {
  const set = (gi: number, g: Partial<ModGroup>) => setMods(mods.map((x, i) => (i === gi ? { ...x, ...g } : x)));
  const setOpt = (gi: number, oi: number, o: Partial<ModGroup["options"][number]>) =>
    set(gi, { options: mods[gi].options.map((x, i) => (i === oi ? { ...x, ...o } : x)) });
  return (
    <div className="mods-ed">
      <div className="mods-ed-h"><b>Options &amp; add-ons</b><span className="muted small">e.g. a flavor guests must pick, or paid extras.</span></div>
      {mods.map((g, gi) => (
        <div key={gi} className="mod-group">
          <div className="row-gap">
            <input value={g.name.en ?? ""} onChange={(e) => set(gi, { name: { ...g.name, en: e.target.value } })} placeholder="Group name, e.g. Wing Flavor" required aria-label="Group name" />
            <input value={g.name.es ?? ""} onChange={(e) => set(gi, { name: { ...g.name, es: e.target.value } })} placeholder="En español (optional)" aria-label="Group name in Spanish" />
            <select value={g.required ? "req" : "opt"} aria-label="Required or optional"
              onChange={(e) => { const req = e.target.value === "req"; set(gi, { required: req, min: req ? Math.max(1, g.min) : 0, max: Math.max(g.max, 1) }); }}>
              <option value="req">Required</option><option value="opt">Optional</option>
            </select>
            <label className="small">{g.required ? "Pick" : "Up to"}{" "}
              <input type="number" min={1} max={20} value={g.max} style={{ width: 60 }} aria-label="How many choices"
                onChange={(e) => { const n = Math.max(1, Math.min(20, Number(e.target.value) || 1)); set(gi, { max: n, min: g.required ? n : 0 }); }} />
            </label>
            <button type="button" className="link-btn danger" onClick={() => setMods(mods.filter((_, i) => i !== gi))}>Remove group</button>
          </div>
          {g.options.map((o, oi) => (
            <div key={oi} className="row-gap mod-opt-row">
              <input value={o.name.en ?? ""} onChange={(e) => setOpt(gi, oi, { name: { ...o.name, en: e.target.value } })} placeholder="Option, e.g. Lemon Pepper" required aria-label="Option name" />
              <label className="small">+$ <input inputMode="decimal" defaultValue={o.priceCents ? (o.priceCents / 100).toFixed(2) : ""} placeholder="0.00" style={{ width: 80 }} aria-label="Extra price"
                onChange={(e) => setOpt(gi, oi, { priceCents: Math.max(0, Math.round((parseFloat(e.target.value.replace("$", "")) || 0) * 100)) })} /></label>
              <button type="button" className="icon-btn" aria-label="Remove option" disabled={g.options.length === 1} onClick={() => set(gi, { options: g.options.filter((_, i) => i !== oi) })}>×</button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => set(gi, { options: [...g.options, { name: { en: "" }, priceCents: 0 }] })}>+ Add option</button>
        </div>
      ))}
      <button type="button" className="btn-sm" onClick={() => setMods([...mods, blankGroup()])}>+ Add option group</button>
    </div>
  );
}

function AddCategory() {
  const { pending, msg, run } = useAct();
  return (
    <section className="card">
      <h2>Add a section</h2>
      <form className="row-gap" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); run(async () => { const r = await A.saveCategory({ en: String(f.get("en")), es: String(f.get("es")), display: String(f.get("display")) as "list" | "cards" }); if (r.ok) form.reset(); return r; }); }}>
        <input name="en" placeholder="e.g. Desserts or Wing Flavors" required />
        <input name="es" placeholder="Postres (optional)" />
        <select name="display" defaultValue="list" aria-label="How this section looks">
          <option value="list">As a list</option>
          <option value="cards">As cards</option>
        </select>
        <button className="btn" disabled={pending}>Add section</button>
      </form>
      <Msg m={msg} />
    </section>
  );
}
