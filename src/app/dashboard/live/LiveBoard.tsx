"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { resolveRequest } from "./actions";
import type { Req, TableInfo } from "./data";

const KIND = {
  help: { icon: "🙋", label: "Needs help" },
  check: { icon: "🧾", label: "Wants the check" },
  refill: { icon: "🥤", label: "Drink refill" },
} as const;

const mins = (from: string, to = Date.now()) => Math.max(0, Math.floor((to - new Date(from).getTime()) / 60000));
const ago = (m: number) => (m < 1 ? "just now" : m === 1 ? "1 min" : `${m} min`);

/** Two-note chime made in the browser, so no sound file is needed. */
function chime(ctx: AudioContext) {
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f;
    const t = ctx.currentTime + i * 0.18;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
  });
}

export default function LiveBoard({ locationId, initial, tableInfo, sectionStaff, compact = false }: {
  locationId: string; initial: Req[]; tableInfo: TableInfo; sectionStaff: Record<string, string[]>; compact?: boolean;
}) {
  const [reqs, setReqs] = useState<Req[]>(initial);
  const [connected, setConnected] = useState(false);
  const [sound, setSound] = useState(false);
  const [awake, setAwake] = useState(false);
  const [, tick] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<any>(null);
  const seen = useRef(new Set(initial.map((r) => r.id)));
  const boardRef = useRef<HTMLDivElement>(null);

  const upsert = useCallback((r: Req) => {
    setReqs((cur) => {
      const i = cur.findIndex((x) => x.id === r.id);
      if (i === -1) return [r, ...cur];
      const next = cur.slice(); next[i] = r; return next;
    });
    if (r.status === "open" && !seen.current.has(r.id)) {
      seen.current.add(r.id);
      if (audio.current) chime(audio.current);
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, []);

  // Live updates from the database, plus a safety refresh every 30 seconds.
  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;
    const toReq = (r: any): Req => ({ id: r.id, tableId: r.table_id, kind: r.kind, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at });
    const refresh = async () => {
      const { data } = await sb.from("service_requests").select("id, table_id, kind, status, created_at, resolved_at").eq("location_id", locationId).eq("status", "open");
      if (!alive || !data) return;
      const open = new Set(data.map((r) => r.id));
      data.forEach((r) => upsert(toReq(r)));
      setReqs((cur) => cur.map((r) => (r.status === "open" && !open.has(r.id) ? { ...r, status: "done", resolvedAt: r.resolvedAt ?? new Date().toISOString() } : r)));
    };
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      channel = sb.channel(`requests-${locationId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "service_requests", filter: `location_id=eq.${locationId}` },
          (p) => { if (p.new && (p.new as any).id) upsert(toReq(p.new)); })
        .subscribe((status) => alive && setConnected(status === "SUBSCRIBED"));
    })();
    const poll = setInterval(refresh, 30_000);
    const clock = setInterval(() => tick((n) => n + 1), 15_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); document.removeEventListener("visibilitychange", onVisible); if (channel) sb.removeChannel(channel); };
  }, [locationId, upsert]);

  useEffect(() => { try { if (localStorage.getItem("taptab-sound") === "on") setSound(true); } catch {} }, []);
  useEffect(() => {
    if (sound && !audio.current) audio.current = new AudioContext();
    if (!sound && audio.current) { audio.current.close(); audio.current = null; }
    try { localStorage.setItem("taptab-sound", sound ? "on" : "off"); } catch {}
  }, [sound]);

  async function toggleAwake() {
    if (awake) { await wake.current?.release?.(); wake.current = null; setAwake(false); return; }
    try { wake.current = await (navigator as any).wakeLock?.request("screen"); setAwake(!!wake.current); } catch { setAwake(false); }
  }
  function fullScreen() { boardRef.current?.requestFullscreen?.().catch(() => {}); }

  async function done(id: string) {
    setReqs((cur) => cur.map((r) => (r.id === id ? { ...r, status: "done", resolvedAt: new Date().toISOString() } : r)));
    const r = await resolveRequest(id);
    if (r.error) setReqs((cur) => cur.map((x) => (x.id === id ? { ...x, status: "open", resolvedAt: null } : x)));
  }

  const open = useMemo(() => reqs.filter((r) => r.status === "open").sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [reqs]);
  const doneToday = reqs.filter((r) => r.status === "done" && r.resolvedAt);
  const avg = doneToday.length ? Math.round(doneToday.reduce((s, r) => s + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()), 0) / doneToday.length / 60000) : null;
  const tableOf = (r: Req) => (r.tableId && tableInfo[r.tableId]) || { label: "?", section: null };
  const who = (sec: string | null) => [...(sec ? sectionStaff[sec.toUpperCase()] ?? [] : []), ...(sectionStaff["*"] ?? [])];

  return (
    <div ref={boardRef} className={`live${compact ? " compact" : ""}`}>
      <div className="live-head">
        <div>
          <h2>{open.length ? `${open.length} table${open.length > 1 ? "s" : ""} waiting` : "All caught up"}</h2>
          <p className="muted small">
            <span className={`dot ${connected ? "on" : ""}`} /> {connected ? "Live" : "Connecting…"}
            {" · "}{doneToday.length} handled today{avg != null ? ` · avg ${avg < 1 ? "<1" : avg} min` : ""}
          </p>
        </div>
        <div className="row-gap">
          <button className={`btn-sm${sound ? " on" : ""}`} onClick={() => { setSound((s) => !s); if (!sound) setTimeout(() => audio.current && chime(audio.current), 50); }}>
            {sound ? "🔔 Sound on" : "🔕 Turn on sound"}
          </button>
          {compact ? <Link className="btn-sm" href="/dashboard/live">Open host screen</Link> : (
            <>
              <button className={`btn-sm${awake ? " on" : ""}`} onClick={toggleAwake}>{awake ? "☀️ Screen stays on" : "Keep screen on"}</button>
              <button className="btn-sm" onClick={fullScreen}>Full screen</button>
            </>
          )}
        </div>
      </div>

      {open.length ? (
        <div className="live-grid">
          {open.map((r) => {
            const t = tableOf(r); const m = mins(r.createdAt);
            const level = m >= 6 ? "late" : m >= 3 ? "warn" : "";
            const servers = who(t.section);
            return (
              <article key={r.id} className={`req-card ${level}`}>
                <div className={`req-table${t.label.length > 3 ? " long" : ""}`}><small>Table</small>{t.label}</div>
                <div className="req-body">
                  <b>{KIND[r.kind].icon} {KIND[r.kind].label}</b>
                  <span className="muted small">{ago(m)}{t.section ? ` · Section ${t.section}` : ""}{servers.length ? ` · ${servers.join(", ")}` : ""}</span>
                </div>
                <button className="req-done" onClick={() => done(r.id)}>Done</button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="live-empty">No one is waiting. New requests appear here instantly{sound ? " with a chime" : ""}.</p>
      )}

      {!compact && doneToday.length > 0 && (
        <section className="live-done">
          <h3>Handled today</h3>
          <ul className="list">
            {doneToday.slice(0, 12).map((r) => (
              <li key={r.id}><b>Table {tableOf(r).label}</b> {KIND[r.kind].label} <span className="muted small">answered in {ago(mins(r.createdAt, new Date(r.resolvedAt!).getTime()))} · {new Date(r.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
