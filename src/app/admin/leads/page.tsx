import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Demo requests · TapTab admin" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function Leads() {
  const { db } = await requireAdmin();
  const { data: leads } = await db.from("leads").select("id, name, restaurant, email, phone, tables, message, created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <h1>Demo requests</h1>
      <p className="muted">From the “Book a demo” form on the website, newest first.</p>
      <section className="card">
        {leads?.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Name</th><th>Business</th><th>Contact</th><th>Tables</th><th>Message</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="small">{when(l.created_at)}</td>
                    <td><b>{l.name}</b></td>
                    <td>{l.restaurant}</td>
                    <td className="small">{l.email && <a href={`mailto:${l.email}`}>{l.email}</a>}{l.email && l.phone && <br />}{l.phone && <a href={`tel:${l.phone}`}>{l.phone}</a>}</td>
                    <td>{l.tables ?? "-"}</td>
                    <td className="small">{l.message?.split("\n\n(")[0] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="live-empty">No demo requests yet. They appear here as soon as someone sends the form on the website.</p>}
      </section>
    </>
  );
}
