import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import NewRestaurantForm from "./NewRestaurantForm";

export const metadata = { title: "Admin · TapTab" };

export default async function Admin() {
  const { db } = await requireAdmin();
  const { data: orgs } = await db.from("organizations")
    .select("id, name, plan, status, created_at, locations(id, name, dining_tables(count))")
    .order("created_at", { ascending: false });
  return (
    <>
      <h1>Restaurants</h1>
      <section className="card">
        <table className="tbl">
          <thead><tr><th>Restaurant</th><th>Plan</th><th>Status</th><th>Tables</th><th></th></tr></thead>
          <tbody>
            {(orgs ?? []).flatMap((o: any) => (o.locations?.length ? o.locations : [null]).map((l: any) => (
              <tr key={o.id + (l?.id ?? "")}>
                <td><b>{l?.name ?? o.name}</b></td>
                <td>{o.plan}</td>
                <td><span className="pill">{o.status}</span></td>
                <td>{l?.dining_tables?.[0]?.count ?? 0}</td>
                <td>{l && <Link href={`/admin/locations/${l.id}`}>Tags &amp; QR codes →</Link>}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Add a restaurant</h2>
        <p className="muted small">Creates the restaurant, its tables and one tag per table. If you add the owner’s email, they get an invite to set their password.</p>
        <NewRestaurantForm />
      </section>
    </>
  );
}
