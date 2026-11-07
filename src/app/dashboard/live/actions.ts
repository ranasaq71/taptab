"use server";
import { requireLocation } from "@/lib/auth/session";

/** Marks a table request done. Any staff member of this restaurant can do it (the security rules check). */
export async function resolveRequest(id: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await requireLocation("/dashboard/live");
  const { error, count } = await ctx.db.from("service_requests")
    .update({ status: "done", resolved_at: new Date().toISOString(), resolved_by: ctx.user.id }, { count: "exact" })
    .eq("id", id).eq("location_id", ctx.location.id).eq("status", "open");
  if (error) return { error: "Couldn’t update. Check your connection." };
  return count ? { ok: true } : { ok: true }; // already done by someone else is fine
}
