import Link from "next/link";
import { requireLocation } from "@/lib/auth/session";
import { ReadToggle, MarkAll } from "./NoteActions";

export const metadata = { title: "Guest notes · TapTab" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { db, location } = await requireLocation("/dashboard/notes", { edit: true });
  const show = (await searchParams).show === "all" ? "all" : "unread";
  let q = db.from("guest_notes").select("id, stars, body, created_at, read_at, table:dining_tables(label)").eq("location_id", location.id).order("created_at", { ascending: false }).limit(200);
  if (show === "unread") q = q.is("read_at", null);
  const [{ data: notes }, { count: unread }, { data: stats }] = await Promise.all([
    q,
    db.from("guest_notes").select("id", { count: "exact", head: true }).eq("location_id", location.id).is("read_at", null),
    db.from("guest_notes").select("stars").eq("location_id", location.id).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);
  const rated = (stats ?? []).filter((n) => n.stars);
  const avg = rated.length ? (rated.reduce((s, n) => s + (n.stars ?? 0), 0) / rated.length).toFixed(1) : null;

  return (
    <>
      <h1>Guest notes</h1>
      <p className="muted">Private messages guests send from the review screen. Only owners and managers see these.</p>
      <div className="stats">
        <div><b>{unread ?? 0}</b><span>Unread</span></div>
        <div><b>{stats?.length ?? 0}</b><span>Notes, last 30 days</span></div>
        <div><b>{avg ?? "-"}</b><span>Average stars (notes)</span></div>
        <div><b>{rated.filter((n) => (n.stars ?? 5) <= 3).length}</b><span>3 stars or less</span></div>
      </div>
      <section className="card">
        <div className="cat-head">
          <div className="seg">
            <Link href="/dashboard/notes" aria-current={show === "unread" ? "page" : undefined}>Unread ({unread ?? 0})</Link>
            <Link href="/dashboard/notes?show=all" aria-current={show === "all" ? "page" : undefined}>All</Link>
          </div>
          <MarkAll disabled={!unread} />
        </div>
        {notes?.length ? (
          <ul className="notes">
            {notes.map((n: any) => {
              const low = n.stars && n.stars <= 3;
              return (
                <li key={n.id} className={`${n.read_at ? "read" : "unread"}${low ? " low" : ""}`}>
                  <div className="note-meta">
                    <span className="note-stars" aria-label={n.stars ? `${n.stars} stars` : "No rating"}>{n.stars ? "★".repeat(n.stars) + "☆".repeat(5 - n.stars) : "No rating"}</span>
                    <span className="muted small">Table {(Array.isArray(n.table) ? n.table[0] : n.table)?.label ?? "?"} · {when(n.created_at)}</span>
                    {low && <span className="pill warn-pill">Follow up</span>}
                  </div>
                  <p>{n.body}</p>
                  <ReadToggle id={n.id} read={!!n.read_at} />
                </li>
              );
            })}
          </ul>
        ) : <p className="live-empty">{show === "unread" ? "You’re all caught up. No unread notes." : "No notes yet. Guests can send one from the review screen."}</p>}
      </section>
    </>
  );
}
