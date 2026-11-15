import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import InviteForm from "@/app/dashboard/team/InviteForm";
import { openSupport } from "../../support";
import { siteUrl } from "@/lib/site";
import { AccountForm, FreeMonths, OwnerLogin, OrderRow, AddOrder, SpareTags, TagToggle } from "./Controls";

export const metadata = { title: "Manage restaurant · TapTab admin" };
export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : "never");

export default async function ManageLocation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: loc } = await db.from("locations").select("id, name, slug, org_id, created_at, organizations(id, name, plan, status, created_at, free_until, free_note)").eq("id", id).maybeSingle();
  if (!loc) notFound();
  const org: any = Array.isArray((loc as any).organizations) ? (loc as any).organizations[0] : (loc as any).organizations;
  const [{ data: orders }, { data: tags }, { data: tables }, { data: members }] = await Promise.all([
    db.from("hardware_orders").select("id, stand_type, quantity, status, notes, created_at, updated_at").eq("location_id", id).order("created_at", { ascending: false }),
    db.from("tags").select("code, status, table_id, last_tap_at, encoded_at").eq("location_id", id),
    db.from("dining_tables").select("id, label, sort_order").eq("location_id", id).order("sort_order"),
    db.from("org_members").select("user_id, role, profiles(full_name)").eq("org_id", loc.org_id),
  ]);
  const admin = supabaseAdmin();
  const team = await Promise.all((members ?? []).map(async (m: any) => {
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { id: m.user_id, role: m.role, name: p?.full_name, email: data.user?.email, lastSignIn: data.user?.last_sign_in_at ?? null };
  }));
  const label = Object.fromEntries((tables ?? []).map((t) => [t.id, t.label]));
  const order = Object.fromEntries((tables ?? []).map((t) => [t.id, t.sort_order]));
  const sorted = [...(tags ?? [])].sort((a, b) => (a.status === b.status ? (order[a.table_id ?? ""] ?? 999) - (order[b.table_id ?? ""] ?? 999) : a.status === "assigned" ? -1 : b.status === "assigned" ? 1 : a.status === "unassigned" ? -1 : 1));
  const counts = { assigned: 0, unassigned: 0, disabled: 0 } as Record<string, number>;
  (tags ?? []).forEach((t) => counts[t.status]++);

  return (
    <>
      <p><Link href="/admin">← All restaurants</Link></p>
      <div className="cat-head">
        <div><h1>{loc.name}</h1><p className="muted">Customer since {day(org?.created_at ?? loc.created_at)} · {tables?.length ?? 0} tables</p></div>
        <div className="row-gap">
          <form action={openSupport.bind(null, loc.id)}><button className="btn">Open their dashboard</button></form>
          <Link className="btn-sm" href={`/admin/locations/${loc.id}/qr`}>QR sheet</Link>
        </div>
      </div>

      <section className="card">
        <h2>Account</h2>
        <AccountForm locationId={loc.id} orgId={loc.org_id} plan={org?.plan ?? "essential"} status={org?.status ?? "trial"} />
        <FreeMonths locationId={loc.id} orgId={loc.org_id} freeUntil={org?.free_until ?? null} note={org?.free_note ?? null} />
        <p className="muted small">Billing with Stripe isn’t connected yet; set the plan and status here by hand. When it is, restaurants in a free period won’t be charged until it ends.</p>
      </section>

      <section className="card">
        <h2>Hardware orders</h2>
        {orders?.length ? orders.map((o) => <OrderRow key={o.id} locationId={loc.id} o={o} />) : <p className="muted small">No orders yet.</p>}
        <h3 className="sub-h">New order</h3>
        <AddOrder locationId={loc.id} tables={tables?.length ?? 0} />
      </section>

      <section className="card">
        <div className="cat-head">
          <div>
            <h2>Tags</h2>
            <p className="muted small">{counts.assigned} on tables · {counts.unassigned} spare · {counts.disabled} disabled. Write each tag’s NFC link onto its chip, then lock it.</p>
          </div>
          <div className="row-gap">
            <a className="btn-sm" href={`/admin/locations/${loc.id}/tags.csv`}>⬇ Tag list (CSV)</a>
            <SpareTags locationId={loc.id} />
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Tag</th><th>Table</th><th>Status</th><th>Last tap</th><th></th></tr></thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.code} className={t.status === "disabled" ? "dim" : ""}>
                  <td><code>{t.code}</code></td>
                  <td>{t.table_id ? `Table ${label[t.table_id] ?? "?"}` : "-"}</td>
                  <td><span className={`pill${t.status === "disabled" ? " warn-pill" : ""}`}>{t.status === "assigned" ? "On a table" : t.status === "unassigned" ? "Spare" : "Disabled"}</span></td>
                  <td className="small">{day(t.last_tap_at)}</td>
                  <td><TagToggle locationId={loc.id} code={t.code} disabled={t.status === "disabled"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Team</h2>
        {team.length ? (
          <ul className="list">
            {team.map((p) => <li key={p.id}><b>{p.name || p.email}</b> <span className="muted small">{p.email} · last sign-in {day(p.lastSignIn)}</span> <span className="pill">{p.role}</span></li>)}
          </ul>
        ) : <p className="muted small">No one has access yet. Invite the owner below.</p>}
        <h3 className="sub-h">Create the owner’s login</h3>
        <p className="muted small">Makes a login with a temporary password you share with the owner yourself (text or WhatsApp). No email needed.</p>
        <OwnerLogin locationId={loc.id} orgId={loc.org_id} restaurant={loc.name} site={await siteUrl()} />
        <h3 className="sub-h">Invite someone by email</h3>
        <InviteForm orgId={loc.org_id} />
      </section>
    </>
  );
}
