import { requireLocation } from "@/lib/auth/session";
import TableRow from "./TableRow";
import { AddTable, AssignSpare } from "./AddTable";

export const metadata = { title: "Tables · TapTab" };

export default async function TablesPage() {
  const { db, location } = await requireLocation("/dashboard/tables", { edit: true });
  const [{ data: tables }, { data: spares }] = await Promise.all([
    db.from("dining_tables").select("id, label, section, sort_order, tags(code, status, last_tap_at)").eq("location_id", location.id).order("sort_order"),
    db.from("tags").select("code").eq("location_id", location.id).eq("status", "unassigned"),
  ]);
  const rows = (tables ?? []).map((t: any) => {
    const tag = (t.tags ?? []).find((x: any) => x.status === "assigned");
    return { id: t.id, label: t.label, section: t.section, code: tag?.code ?? null, lastTap: tag?.last_tap_at ?? null };
  });
  const simple = rows.map((r) => ({ id: r.id, label: r.label }));
  return (
    <>
      <h1>Tables</h1>
      <p className="muted">Rename tables, set server sections, and move a tag if you swap a stand. Sections decide which server gets each table’s alerts.</p>
      <section className="card">
        <h2>{rows.length} tables</h2>
        <div className="trows">
          {rows.map((r) => <TableRow key={r.id} t={r} others={simple.filter((o) => o.id !== r.id)} />)}
        </div>
      </section>
      {!!spares?.length && (
        <section className="card">
          <h2>Spare tags</h2>
          <p className="muted small">Tags not on any table. Put one on a table to replace a lost or broken stand.</p>
          {spares.map((s) => <AssignSpare key={s.code} code={s.code} tables={rows.map((r) => ({ id: r.id, label: r.label, hasTag: !!r.code }))} />)}
        </section>
      )}
      <section className="card">
        <h2>Add a table</h2>
        <AddTable />
      </section>
    </>
  );
}
