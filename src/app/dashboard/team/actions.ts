"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";
import type { FormState } from "@/app/login/actions";

const Invite = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["owner", "manager", "staff"]),
});

/** Invite someone to a restaurant. Allowed for that restaurant's owners and for TapTab admins. */
export async function inviteMember(_: FormState, f: FormData): Promise<FormState> {
  const parsed = Invite.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: "Check the email address and try again." };
  const { orgId, name, email, role } = parsed.data;
  const s = await requireUser();
  const isOwner = s.memberships.some((m) => m.orgId === orgId && m.role === "owner");
  if (!isOwner && !s.isAdmin) return { error: "Only the restaurant owner can invite people." };
  return inviteToOrg({ orgId, name, email, role });
}

export async function inviteToOrg({ orgId, name, email, role }: { orgId: string; name?: string; email: string; role: "owner" | "manager" | "staff" }): Promise<FormState> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name || undefined },
    redirectTo: `${await siteUrl()}/auth/accept`,
  });
  let userId = data?.user?.id;
  if (error) {
    // Already has a TapTab account: just add them to this restaurant.
    if (!/already been registered|already exists/i.test(error.message)) return { error: error.message };
    userId = (await findUserIdByEmail(email)) ?? undefined;
    if (!userId) return { error: "That person already has an account, but we couldn’t find it. Contact support." };
  }
  const { error: memberErr } = await admin.from("org_members").upsert({ org_id: orgId, user_id: userId!, role }, { onConflict: "org_id,user_id" });
  if (memberErr) return { error: memberErr.message };
  revalidatePath("/dashboard/team");
  return { message: error ? `${email} already had an account and now has access.` : `Invite sent to ${email}.` };
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = supabaseAdmin();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!data || data.users.length < 200) break;
  }
  return null;
}
