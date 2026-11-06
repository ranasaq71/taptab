import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Dashboard · TapTab" };
const KIND: Record<string, string> = { help: "Needs help", check: "Wants the check", refill: "Drink refill" };

export default async function Overview() {
  const { db, memberships, name } = await requireUser("/dashboard");
  const orgId = memberships[0].orgId;
  const { data: locations } = await db.from("locations").select("id, name").eq("org_id", orgId).order("created_at");
  const loc = locations?.[0];
  if (!loc) return <p className="muted">No restaurant location set up yet. TapTab support will add it for you.</p>;

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [tables, taps, open, notes] = await Promise.all([
    db.from("dining_tables").select("id", { count: "exact", head: true }).eq("location_id", loc.id),
    db.from("events").select("id", { count: "exact", head: true }).eq("location_id", loc.id).eq("type", "tap").gte("created_at", since),
    db.from("service_requests").select("id, kind, created_at, table:dining_tables(label)").eq("location_id", loc.id).eq("status", "open").order("created_at", { ascending: false }),
    db.from("guest_notes").select("id", { count: "exact", head: true }).eq("location_id", loc.id).gte("created_at", since),
  ]);

  return (
    <>
      <h1>Hi {name.split(" ")[0] || "there"}</h1>
      <p className="muted">{loc.name} · last 7 days</p>
      <div className="stats">
        <div><b>{taps.count ?? 0}</b><span>Taps</span></div>
        <div><b>{tables.count ?? 0}</b><span>Tables</span></div>
        <div><b>{open.data?.length ?? 0}</b><span>Open requests</span></div>
        <div><b>{notes.count ?? 0}</b><span>Guest notes</span></div>
      </div>
      <section className="card">
        <h2>Open table requests</h2>
        {open.data?.length ? (
          <ul className="list">
            {open.data.map((r: any) => (
              <li key={r.id}><b>Table {(Array.isArray(r.table) ? r.table[0] : r.table)?.label ?? "?"}</b> {KIND[r.kind]} <span className="muted">{new Date(r.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span></li>
            ))}
          </ul>
        ) : <p className="muted">No open requests.</p>}
        <p className="muted small">Live updates and “Done” buttons arrive on Day 6.</p>
      </section>
    </>
  );
}
