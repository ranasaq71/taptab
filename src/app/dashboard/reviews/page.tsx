import { requireLocation } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { googleReady } from "@/lib/google";
import { aiAllowance, menuNames, DEFAULT_SETTINGS, type ReviewSettings } from "@/lib/reviews";
import { DraftTool, GoogleCard, InboxItem, PostWriter, SettingsForm } from "./ReviewsClient";

export const metadata = { title: "Reviews · TapTab" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  connected: "Google is connected.",
  cancelled: "Google connection was cancelled.",
  expired: "That Google sign-in expired. Please try again.",
  "no-refresh": "Google didn’t give TapTab lasting access. Remove TapTab from your Google account’s third-party access, then connect again.",
  "not-ready": "Google connection isn’t switched on yet. TapTab is waiting for Google’s approval.",
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ g?: string; msg?: string }> }) {
  const { db, location, orgId } = await requireLocation("/dashboard/reviews", { edit: true });
  const sp = await searchParams;
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const [{ data: rows }, { data: set }, { data: conn }, allow, menu, hub] = await Promise.all([
    db.from("reviews").select("id, source, author, stars, comment, reviewed_at, draft, reply, replied_at, reply_by, status, error").eq("location_id", location.id).order("reviewed_at", { ascending: false }).limit(300),
    db.from("review_settings").select("*").eq("location_id", location.id).maybeSingle(),
    supabaseAdmin().from("google_connections").select("google_email, location_name, location_title, last_sync_at, last_error").eq("location_id", location.id).maybeSingle(),
    aiAllowance(orgId, location.id),
    menuNames(location.id),
    db.from("hub_settings").select("google_review_url").eq("location_id", location.id).maybeSingle(),
  ]);
  const settings: ReviewSettings = { ...DEFAULT_SETTINGS, ...(set ?? {}) };
  const all = rows ?? [];
  const recent = all.filter((r) => (r.reviewed_at ?? "") >= since);
  const rated = recent.filter((r) => r.stars);
  const avg = rated.length ? (rated.reduce((s, r) => s + r.stars!, 0) / rated.length).toFixed(1) : "-";
  const answered = recent.filter((r) => r.status === "posted");
  const rate = recent.length ? Math.round((answered.length / recent.length) * 100) + "%" : "-";
  const hrs = answered.filter((r) => r.replied_at && r.reviewed_at && r.reply_by !== "google")
    .map((r) => (new Date(r.replied_at!).getTime() - new Date(r.reviewed_at!).getTime()) / 36e5).filter((h) => h >= 0);
  const speed = hrs.length ? (() => { const h = hrs.reduce((a, b) => a + b, 0) / hrs.length; return h < 1 ? "< 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`; })() : "-";
  // Which dishes people talk about.
  const mentions = menu.map((m) => ({ m, n: recent.filter((r) => r.comment && r.comment.toLowerCase().includes(m.toLowerCase().replace(/\s*\(.*\)/, ""))).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8);

  const open = all.filter((r) => ["needs_approval", "drafted", "new", "error"].includes(r.status));
  const done = all.filter((r) => r.status === "posted").slice(0, 30);
  const reviewsLink = hub.data?.google_review_url ?? null;

  return (
    <>
      <h1>Reviews</h1>
      <p className="muted">Answer every Google review in your restaurant’s voice. TapTab writes the reply; you decide what posts automatically.</p>
      {sp.g && <p className={`notice${sp.g === "error" ? " error" : ""}`}>{sp.g === "error" ? sp.msg ?? "Couldn’t connect to Google." : NOTICES[sp.g] ?? ""}</p>}

      <div className="stats stats5">
        <div><b>{recent.length}</b><span>Reviews, last 90 days</span></div>
        <div><b>{avg}</b><span>Average stars</span></div>
        <div><b>{rate}</b><span>Answered</span></div>
        <div><b>{speed}</b><span>Average reply time</span></div>
        <div><b>{allow.limit === Infinity ? allow.used : `${allow.used}/${allow.limit}`}</b><span>AI replies this month{allow.limit === Infinity ? " (unlimited)" : ""}</span></div>
      </div>

      <GoogleCard ready={googleReady()} conn={conn ? { email: conn.google_email, listing: conn.location_title, chosen: !!conn.location_name, lastSync: conn.last_sync_at, error: conn.last_error } : null} />

      <section className="card">
        <h2>Draft a reply</h2>
        <p className="muted small">Paste a review from Google and TapTab writes a reply in your voice. Copy it, then paste it under the review on Google.{reviewsLink ? " " : ""}
          {reviewsLink && <a href={reviewsLink.replace(/,3,,,,$/, ",1,,,,")} target="_blank" rel="noopener">Open your Google reviews ↗</a>}</p>
        <DraftTool />
      </section>

      <section className="card">
        <h2>Inbox {open.length > 0 && <span className="pill warn-pill">{open.length} to answer</span>}</h2>
        {open.length ? <ul className="rv-list">{open.map((r) => <InboxItem key={r.id} r={r} />)}</ul>
          : <p className="live-empty">Nothing waiting. {conn?.location_name ? "New Google reviews show up here after each sync." : "Connect Google, or use “Draft a reply” above."}</p>}
      </section>

      <div className="grid2">
        <section className="card">
          <h2>Reply settings</h2>
          <SettingsForm s={settings} restaurant={location.name} />
        </section>
        <section className="card">
          <h2>Google post</h2>
          <p className="muted small">Short updates on your Google listing (specials, holiday hours) help you show up in searches. TapTab writes one from your menu.</p>
          <PostWriter connected={!!conn?.location_name} pro={allow.limit === Infinity} />
          {mentions.length > 0 && <>
            <h3 className="sub-h">Most mentioned dishes</h3>
            <ul className="rv-mentions">{mentions.map((x) => <li key={x.m}><span>{x.m}</span><b>{x.n}</b></li>)}</ul>
          </>}
        </section>
      </div>

      {done.length > 0 && (
        <section className="card">
          <h2>Answered</h2>
          <ul className="rv-list done">{done.map((r) => (
            <li key={r.id}>
              <div className="rv-meta"><span className="rv-stars">{r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : ""}</span><b>{r.author ?? "Guest"}</b>
                <span className="muted small">{r.reply_by === "auto" ? "Posted automatically" : r.reply_by === "google" ? "Answered on Google" : r.source === "manual" ? "Posted by you (copied)" : "Approved by you"}</span></div>
              {r.comment && <p className="rv-text">{r.comment}</p>}
              <p className="rv-reply">↳ {r.reply}</p>
            </li>
          ))}</ul>
        </section>
      )}
    </>
  );
}
