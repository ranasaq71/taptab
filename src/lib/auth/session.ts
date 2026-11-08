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
  role: Membership["role"]; canEdit: boolean; support: boolean; orgId: string;
};

/** The restaurant location this person manages (first one for now). Staff can view; owners and managers can edit. */
export const SUPPORT_COOKIE = "taptab_support_loc";

/**
 * Which restaurant the dashboard shows.
 * - Restaurant staff: their own restaurant.
 * - TapTab admins in support mode (opened from the admin portal): the restaurant they picked, with owner-level access.
 */
export async function resolveDashboard(s: Awaited<ReturnType<typeof requireUser>>) {
  const { cookies } = await import("next/headers");
  const supportId = s.isAdmin ? (await cookies()).get(SUPPORT_COOKIE)?.value : undefined;
  if (supportId) {
    const { data: location } = await s.db.from("locations")
      .select("id, name, tagline, brand_color, logo_url, org_id, organizations(name)").eq("id", supportId).maybeSingle();
    if (location) {
      const org = Array.isArray((location as any).organizations) ? (location as any).organizations[0] : (location as any).organizations;
      return { location, role: "owner" as const, orgId: location.org_id, orgName: org?.name ?? location.name, support: true };
    }
  }
  const m = s.memberships[0];
  if (!m) return null;
  const { data: location } = await s.db.from("locations")
    .select("id, name, tagline, brand_color, logo_url, org_id").eq("org_id", m.orgId).order("created_at").limit(1).maybeSingle();
  if (!location) return null;
  return { location, role: m.role, orgId: m.orgId, orgName: m.orgName, support: false };
}

export async function requireLocation(next = "/dashboard", { edit = false } = {}): Promise<LocationCtx> {
  const s = await requireUser(next);
  const d = await resolveDashboard(s);
  if (!d) redirect(s.isAdmin ? "/admin" : "/app");
  const canEdit = d.role === "owner" || d.role === "manager" || s.isAdmin;
  if (edit && !canEdit) redirect("/dashboard");
  return { ...s, location: d.location, role: d.role, canEdit, support: d.support, orgId: d.orgId };
}
