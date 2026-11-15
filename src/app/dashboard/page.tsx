import { requireLocation } from "@/lib/auth/session";
import LiveBoard from "./live/LiveBoard";
import { loadLive } from "./live/data";

export const metadata = { title: "Dashboard · TapTab" };
export const dynamic = "force-dynamic";

export default async function Overview() {
  const ctx = await requireLocation("/dashboard");
  const { db, location, name } = ctx;
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [tables, taps, notes, live, org] = await Promise.all([
    db.from("dining_tables").select("id", { count: "exact", head: true }).eq("location_id", location.id),
    db.from("events").select("id", { count: "exact", head: true }).eq("location_id", location.id).eq("type", "tap").gte("created_at", since),
    db.from("guest_notes").select("id", { count: "exact", head: true }).eq("location_id", location.id).gte("created_at", since),
    loadLive(ctx),
    db.from("organizations").select("free_until").eq("id", location.org_id).maybeSingle(),
  ]);
  const freeUntil = org.data?.free_until && new Date(org.data.free_until) > new Date()
    ? new Date(org.data.free_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : null;
  return (
    <>
      <h1>Hi {name.split(" ")[0] || "there"}</h1>
      <p className="muted">{location.name} · last 7 days</p>
      {freeUntil && <p className="notice">🎁 TapTab is free for you until <b>{freeUntil}</b>.</p>}
      <div className="stats">
        <div><b>{taps.count ?? 0}</b><span>Taps</span></div>
        <div><b>{tables.count ?? 0}</b><span>Tables</span></div>
        <div><b>{live.initial.filter((r) => r.status === "done").length}</b><span>Requests handled today</span></div>
        <div><b>{notes.count ?? 0}</b><span>Guest notes</span></div>
      </div>
      <section className="card">
        <LiveBoard compact locationId={location.id} initial={live.initial} tableInfo={live.tableInfo} sectionStaff={live.sectionStaff} />
      </section>
    </>
  );
}
