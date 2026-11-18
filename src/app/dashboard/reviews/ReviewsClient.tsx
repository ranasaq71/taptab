"use client";
import { useState, useTransition } from "react";
import * as A from "./actions";
import type { ReviewSettings } from "@/lib/reviews";

type Res = { ok?: boolean; error?: string; msg?: string; text?: string };
function useRun() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Res>({});
  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) => start(async () => { const r = await fn(); setRes(r); after?.(r); });
  return { pending, res, run };
}
const Msg = ({ r }: { r: Res }) => r.error ? <p className="error small">{r.error}</p> : r.msg ? <p className="ok small">{r.msg}</p> : null;

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return <button type="button" className="btn-sm" disabled={!text} onClick={async () => { try { await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 2000); } catch {} }}>{c ? "Copied ✓" : "Copy"}</button>;
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <span className="rv-pick" role="radiogroup" aria-label="Stars">{[1, 2, 3, 4, 5].map((n) =>
    <button type="button" key={n} role="radio" aria-checked={value === n} className={n <= value ? "on" : ""} onClick={() => onChange(n)}>★</button>)}</span>;
}

export function DraftTool() {
  const a = useRun();
  const [stars, setStars] = useState(5);
  const [out, setOut] = useState("");
  return (
    <form className="rv-draft" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); a.run(() => A.draftManual({ author: String(f.get("author") ?? ""), stars, comment: String(f.get("comment") ?? "") }), (r) => r.text && setOut(r.text)); }}>
      <div className="row-gap"><input name="author" placeholder="Reviewer’s name (optional)" maxLength={80} /><Stars value={stars} onChange={setStars} /></div>
      <textarea name="comment" rows={3} placeholder="Paste the review here (leave empty for a rating-only review)" maxLength={4000} />
      <button className="btn" disabled={a.pending}>{a.pending ? "Writing…" : "Write reply"}</button>
      <Msg r={a.res.error ? a.res : {}} />
      {out && <div className="rv-out"><textarea value={out} onChange={(e) => setOut(e.target.value)} rows={5} aria-label="Reply" /><CopyBtn text={out} /></div>}
    </form>
  );
}

export function InboxItem({ r }: { r: { id: string; source: string; author: string | null; stars: number | null; comment: string | null; reviewed_at: string | null; draft: string | null; status: string; error: string | null } }) {
  const a = useRun();
  const [text, setText] = useState(r.draft ?? "");
  const google = r.source === "google";
  return (
    <li className={(r.stars ?? 5) <= 3 ? "low" : ""}>
      <div className="rv-meta">
        <span className="rv-stars">{r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : ""}</span>
        <b>{r.author ?? "Guest"}</b>
        <span className="muted small">{google ? "Google" : "Added by you"}{r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}` : ""}</span>
        {r.status === "needs_approval" && <span className="pill warn-pill">Needs your OK</span>}
      </div>
      {r.comment && <p className="rv-text">{r.comment}</p>}
      {r.error && <p className="error small">{r.error}</p>}
      {text || r.draft ? <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Reply" /> : <p className="muted small">No reply written yet.</p>}
      <div className="row-gap">
        {google
          ? <button className="btn-sm primary" disabled={a.pending || !text.trim()} onClick={() => a.run(() => A.approve(r.id, text))}>Post on Google</button>
          : <><CopyBtn text={text} /><button className="btn-sm" disabled={a.pending || !text.trim()} onClick={() => a.run(() => A.approve(r.id, text))}>I posted it</button></>}
        <button className="link-btn" disabled={a.pending} onClick={() => a.run(() => A.regenerate(r.id), (x) => x.text && setText(x.text))}>{text ? "Rewrite" : "Write reply"}</button>
        <button className="link-btn" disabled={a.pending} onClick={() => a.run(() => A.skip(r.id))}>Skip</button>
      </div>
      <Msg r={a.res} />
    </li>
  );
}

export function SettingsForm({ s, restaurant }: { s: ReviewSettings; restaurant: string }) {
  const a = useRun();
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
      a.run(() => A.saveSettings({ tone: String(f.get("tone")), sign_off: String(f.get("sign_off") ?? ""), about: String(f.get("about") ?? ""), auto_post_min_stars: Number(f.get("auto")) })); }}>
      <label className="field"><span>Tone</span>
        <select name="tone" defaultValue={s.tone}>
          <option value="friendly">Friendly</option><option value="warm">Warm, family-run</option><option value="professional">Professional</option><option value="fun">Fun</option>
        </select></label>
      <label className="field"><span>Sign-off (optional)</span><input name="sign_off" defaultValue={s.sign_off ?? ""} placeholder={`– The ${restaurant} team`} maxLength={80} /></label>
      <label className="field"><span>About you, for the AI (optional)</span><input name="about" defaultValue={s.about ?? ""} placeholder="e.g. halal Asian-Desi food truck on Richmond Ave" maxLength={200} /></label>
      <label className="field"><span>Post automatically</span>
        <select name="auto" defaultValue={String(s.auto_post_min_stars)}>
          <option value="4">4 and 5-star replies (lower ratings wait for your OK)</option>
          <option value="5">Only 5-star replies</option>
          <option value="6">Never: I approve every reply</option>
          <option value="1">Everything, including 1-star (not recommended)</option>
        </select></label>
      <button className="btn" disabled={a.pending}>{a.pending ? "Saving…" : "Save settings"}</button>
      <Msg r={a.res} />
    </form>
  );
}

export function GoogleCard({ ready, conn }: { ready: boolean; conn: { email: string | null; listing: string | null; chosen: boolean; lastSync: string | null; error: string | null } | null }) {
  const a = useRun();
  const [list, setList] = useState<{ value: string; label: string }[] | null>(null);
  return (
    <section className="card rv-google">
      <h2>Google Business Profile</h2>
      {!ready ? (
        <p className="muted">Automatic replies switch on once Google approves TapTab’s access, usually within a few weeks. Until then, use <b>Draft a reply</b> below: paste a review, copy the reply.</p>
      ) : !conn ? (
        <>
          <p className="muted">Connect the Google account that manages your Business Profile. TapTab will check for new reviews every day, write replies, and post the ones you allow.</p>
          <a className="btn" href="/api/google/connect">Connect Google</a>
        </>
      ) : (
        <>
          <p><span className="pill ok-pill">Connected</span> {conn.listing ? <b>{conn.listing}</b> : <b>No listing chosen</b>}{conn.email ? <span className="muted small"> · {conn.email}</span> : null}</p>
          {conn.lastSync && <p className="muted small">Last checked {new Date(conn.lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</p>}
          {conn.error && <p className="error small">{conn.error}</p>}
          {!conn.chosen && (list
            ? <form className="row-gap" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("l") ?? ""); a.run(async () => { const r = await A.chooseListing(v); if (r.ok) await A.syncNow(); return r; }); }}>
                <select name="l">{list.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
                <button className="btn-sm primary" disabled={a.pending}>Use this listing</button>
              </form>
            : <button className="btn-sm primary" disabled={a.pending} onClick={() => a.run(async () => { const r = await A.listListings(); if (r.items) setList(r.items); return r.error ? { error: r.error } : r.items?.length ? {} : { error: "This Google account doesn’t manage any business listings." }; })}>Choose your listing</button>)}
          <div className="row-gap">
            {conn.chosen && <button className="btn-sm" disabled={a.pending} onClick={() => a.run(() => A.syncNow())}>{a.pending ? "Checking…" : "Check for new reviews"}</button>}
            <button className="link-btn danger" disabled={a.pending} onClick={() => { if (confirm("Disconnect Google? Replies stop posting automatically.")) a.run(() => A.disconnect()); }}>Disconnect</button>
          </div>
        </>
      )}
      <Msg r={a.res} />
    </section>
  );
}

export function PostWriter({ connected, pro }: { connected: boolean; pro: boolean }) {
  const a = useRun();
  const [idea, setIdea] = useState("");
  const [text, setText] = useState("");
  if (!pro) return <p className="muted small">Available on Pro.</p>;
  return (
    <div className="rv-draft">
      <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Idea (optional): e.g. weekend special, open late Friday" maxLength={200} />
      <button className="btn-sm" disabled={a.pending} onClick={() => a.run(() => A.writePost(idea), (r) => r.text && setText(r.text))}>{a.pending ? "Writing…" : "Write a post"}</button>
      {text && <>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Post" />
        <div className="row-gap"><CopyBtn text={text} />{connected && <button className="btn-sm primary" disabled={a.pending} onClick={() => a.run(() => A.publishPost(text))}>Post on Google</button>}</div>
      </>}
      <Msg r={a.res} />
    </div>
  );
}
