"use server";
import { revalidatePath } from "next/cache";
import { requireLocation } from "@/lib/auth/session";

export async function setRead(id: string, read: boolean) {
  const ctx = await requireLocation("/dashboard/notes", { edit: true });
  await ctx.db.from("guest_notes").update({ read_at: read ? new Date().toISOString() : null }).eq("id", id).eq("location_id", ctx.location.id);
  revalidatePath("/dashboard", "layout");
}

export async function markAllRead() {
  const ctx = await requireLocation("/dashboard/notes", { edit: true });
  await ctx.db.from("guest_notes").update({ read_at: new Date().toISOString() }).eq("location_id", ctx.location.id).is("read_at", null);
  revalidatePath("/dashboard", "layout");
}
