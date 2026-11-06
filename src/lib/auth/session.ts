import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Membership = { orgId: string; orgName: string; role: "owner" | "manager" | "staff" };

/** The signed-in user, their admin flag and restaurant memberships. Redirects to /login if signed out. */
export async function requireUser(next = "/app") {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const [{ data: profile }, { data: rows }] = await Promise.all([
    db.from("profiles").select("full_name, is_platform_admin").eq("id", user.id).maybeSingle(),
    db.from("org_members").select("role, org:organizations(id, name)").eq("user_id", user.id),
  ]);
  const memberships: Membership[] = (rows ?? []).flatMap((r: any) => {
    const org = Array.isArray(r.org) ? r.org[0] : r.org;
    return org ? [{ orgId: org.id, orgName: org.name, role: r.role }] : [];
  });
  return { db, user, name: profile?.full_name ?? user.email ?? "", isAdmin: !!profile?.is_platform_admin, memberships };
}

export async function requireAdmin(next = "/admin") {
  const s = await requireUser(next);
  if (!s.isAdmin) redirect("/app");
  return s;
}

export type LocationCtx = Awaited<ReturnType<typeof requireUser>> & {
  location: { id: string; name: string; tagline: string | null; brand_color: string; logo_url: string | null; org_id: string };
  role: Membership["role"]; canEdit: boolean;
};

/** The restaurant location this person manages (first one for now). Staff can view; owners and managers can edit. */
export async function requireLocation(next = "/dashboard", { edit = false } = {}): Promise<LocationCtx> {
  const s = await requireUser(next);
  const m = s.memberships[0];
  if (!m) redirect(s.isAdmin ? "/admin" : "/app");
  const { data: location } = await s.db.from("locations")
    .select("id, name, tagline, brand_color, logo_url, org_id").eq("org_id", m.orgId).order("created_at").limit(1).maybeSingle();
  if (!location) redirect("/dashboard");
  const canEdit = m.role === "owner" || m.role === "manager" || s.isAdmin;
  if (edit && !canEdit) redirect("/dashboard");
  return { ...s, location, role: m.role, canEdit };
}
