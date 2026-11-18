import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import NewRestaurantForm from "./NewRestaurantForm";
import { openSupport } from "./support";

export const metadata = { title: "Admin · TapTab" };
export const dynamic = "force-dynamic";

const DAY = 864e5;
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
};

export default async function Admin() {
  const { db } = await requireAdmin();
  const week = new Date(Date.now() - 7 * DAY).toISOString();
  const [{ data: orgs }, { data: taps }, { data: reqs }, { data: tags }, { data: hubs }, { data: staff }, { data: items }, { data: cards }, { data: notes }, { data: hw }, { data: revs }] = await Promise.all([
    db.from("organizations").select("id, name, plan, status, created_at, free_until, locations(id, name, created_at)").order("created_at", { ascending: false }),
    db.from("events").select("location_id").eq("type", "tap").gte("created_at", week).limit(100000),
    db.from("service_requests").select("location_id, status, created_at, resolved_at").or(`status.eq.open,created_at.gte.${week}`).limit(50000),
    db.from("tags").select("location_id, status, last_tap_at"),
    db.from("hub_settings").select("location_id, google_review_url"),
    db.from("staff_contacts").select("location_id"),
    db.from("menu_items").select("id, menu_categories!inner(menus!inner(location_id))").limit(100000),
    db.from("loyalty_cards").select("location_id, last_stamp_at"),
    db.from("guest_notes").select("location_id, stars, read_at").gte("created_at", week),
    db.from("hardware_orders").select("location_id, status, created_at").order("created_at", { ascending: false }),
    db.from("reviews").select("location_id, status").in("status", ["needs_approval", "new", "error"]),
  ]);

  const by = <T,>(rows: T[] | null, key: (r: T) => string | null | undefined) => {
    const m = new Map<string, T[]>(); for (const r of rows ?? []) { const k = key(r); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(r); } return m;
  };
  const tapsBy = by(taps, (r) => r.location_id), reqBy = by(reqs, (r) => r.location_id), tagBy = by(tags, (r) => r.location_id);
  const staffBy = by(staff, (r) => r.location_id), cardBy = by(cards, (r) => r.location_id), noteBy = by(notes, (r) => r.location_id);
  const itemBy = by(items, (r: any) => { const c = Array.isArray(r.menu_categories) ? r.menu_categories[0] : r.menu_categories; const m = Array.isArray(c?.menus) ? c.menus[0] : c?.menus; return m?.location_id; });
  const revBy = by(revs, (r) => r.location_id);
  const googleBy = new Map((hubs ?? []).map((h) => [h.location_id, h.google_review_url]));
  const hwBy = new Map<string, string>(); for (const o of hw ?? []) if (!hwBy.has(o.location_id)) hwBy.set(o.location_id, o.status);

  const rows = (orgs ?? []).flatMap((o: any) => (o.locations ?? []).map((l: any) => {
    const lt = tagBy.get(l.id) ?? [], lr = reqBy.get(l.id) ?? [];
    const open = lr.filter((r) => r.status === "open");
    const stuck = open.filter((r) => Date.now() - new Date(r.created_at).getTime() > 10 * 60000).length;
    const handled = lr.filter((r) => r.status === "done" && r.resolved_at);
    const avg = handled.length ? handled.reduce((s, r) => s + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()), 0) / handled.length / 60000 : null;
    const lastTap = lt.reduce<string | null>((m, t) => (t.last_tap_at && (!m || t.last_tap_at > m) ? t.last_tap_at : m), null);
    const neverTapped = lt.filter((t) => t.status === "assigned" && !t.last_tap_at).length;
    const issues: string[] = [];
    if (stuck) issues.push(`${stuck} request${stuck > 1 ? "s" : ""} waiting 10+ min`);
    if (lt.length && (!lastTap || Date.now() - new Date(lastTap).getTime() > 7 * DAY)) issues.push("No taps in 7 days");
    if (neverTapped) issues.push(`${neverTapped} tag${neverTapped > 1 ? "s" : ""} never tapped`);
    if (!(itemBy.get(l.id)?.length)) issues.push("Menu is empty");
    if (!googleBy.get(l.id)) issues.push("No Google review link");
    if (!(staffBy.get(l.id)?.length)) issues.push("No staff for alerts");
    const unanswered = revBy.get(l.id)?.length ?? 0;
    if (unanswered) issues.push(`${unanswered} Google review${unanswered > 1 ? "s" : ""} to answer`);
    return { org: o, loc: l, taps: tapsBy.get(l.id)?.length ?? 0, open: open.length, stuck, avg, lastTap, tables: lt.length, members: cardBy.get(l.id)?.length ?? 0,
      lowNotes: (noteBy.get(l.id) ?? []).filter((n) => (n.stars ?? 5) <= 3).length, issues, hardware: hwBy.get(l.id) ?? null };
  }));

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const handledAll = (reqs ?? []).filter((r) => r.status === "done" && r.resolved_at);
  const avgAll = handledAll.length ? Math.round(handledAll.reduce((s, r) => s + (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()), 0) / handledAll.length / 60000) : null;

  return (
    <>
      <h1>All restaurants</h1>
      <p className="muted">Platform view, last 7 days. Open any restaurant’s dashboard to see exactly what the owner sees and fix it.</p>
      <div className="stats">
        <div><b>{rows.length}</b><span>Restaurants</span></div>
        <div><b>{sum((r) => r.taps).toLocaleString()}</b><span>Guest taps</span></div>
        <div><b>{handledAll.length}</b><span>Requests handled{avgAll != null ? ` · avg ${avgAll} min` : ""}</span></div>
        <div><b>{sum((r) => r.members)}</b><span>Rewards members</span></div>
      </div>

      <section className="card">
        <h2>Restaurants &amp; health</h2>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Restaurant</th><th>Plan</th><th>Taps (7d)</th><th>Last tap</th><th>Open</th><th>Avg response</th><th>Members</th><th>Hardware</th><th>Needs attention</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.loc.id}>
                  <td><b>{r.loc.name}</b><div className="muted small">{r.tables} tables{r.org.name !== r.loc.name ? ` · ${r.org.name}` : ""}</div></td>
                  <td><span className="pill">{r.org.plan}</span> <span className="muted small">{r.org.status}</span>{r.org.free_until && new Date(r.org.free_until) > new Date() && <> <span className="pill ok-pill" title={`Free until ${new Date(r.org.free_until).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`}>Free</span></>}</td>
                  <td>{r.taps}</td>
                  <td className="small">{ago(r.lastTap)}</td>
                  <td>{r.open ? <span className={r.stuck ? "pill warn-pill" : "pill"}>{r.open}</span> : "0"}</td>
                  <td>{r.avg != null ? `${Math.round(r.avg)} min` : "-"}</td>
                  <td>{r.members}</td>
                  <td>{r.hardware ? <span className="pill">{r.hardware}</span> : <span className="muted small">none</span>}</td>
                  <td>{r.issues.length ? <ul className="issues">{r.issues.map((i: string) => <li key={i}>{i}</li>)}</ul> : <span className="ok">✓ Healthy</span>}{r.lowNotes ? <div className="muted small">{r.lowNotes} low-rated note{r.lowNotes > 1 ? "s" : ""}</div> : null}</td>
                  <td className="row-actions">
                    <form action={openSupport.bind(null, r.loc.id)}><button className="btn-sm">Open dashboard</button></form>
                    <Link href={`/admin/locations/${r.loc.id}`} className="small">Manage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Add a restaurant</h2>
        <p className="muted small">Creates the restaurant, its tables and one tag per table. If you add the owner’s email, they get an invite to set their password.</p>
        <NewRestaurantForm />
      </section>
    </>
  );
}
