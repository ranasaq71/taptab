import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import InviteForm from "./InviteForm";

export const metadata = { title: "Team · TapTab" };

export default async function Team() {
  const s = await requireUser("/dashboard/team");
  const m = s.memberships[0];
  if (!m || m.role !== "owner") redirect("/dashboard");
  // Names and emails of teammates come from the admin client, after confirming this person is the owner.
  const admin = supabaseAdmin();
  const { data: rows } = await admin.from("org_members").select("user_id, role, profile:profiles(full_name)").eq("org_id", m.orgId);
  const members = await Promise.all((rows ?? []).map(async (r: any) => {
    const { data } = await admin.auth.admin.getUserById(r.user_id);
    return { id: r.user_id, role: r.role, name: (Array.isArray(r.profile) ? r.profile[0] : r.profile)?.full_name, email: data.user?.email };
  }));
  return (
    <>
      <h1>Team</h1>
      <section className="card">
        <h2>People with access</h2>
        <ul className="list">
          {members.map((p) => <li key={p.id}><b>{p.name || p.email}</b> <span className="muted">{p.email}</span> <span className="pill">{p.role}</span></li>)}
        </ul>
      </section>
      <section className="card">
        <h2>Invite someone</h2>
        <InviteForm orgId={m.orgId} />
      </section>
    </>
  );
}
