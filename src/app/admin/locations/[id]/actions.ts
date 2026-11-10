"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { newTagCode } from "@/lib/site";

type R = { ok?: true; error?: string; message?: string };
const done = (locationId: string, message?: string): R => { revalidatePath(`/admin/locations/${locationId}`); revalidatePath("/admin"); return { ok: true, message }; };

export async function updateAccount(locationId: string, orgId: string, plan: string, status: string): Promise<R> {
  const { db } = await requireAdmin();
  const p = z.object({ plan: z.enum(["essential", "pro", "business"]), status: z.enum(["trial", "active", "past_due", "canceled"]) }).safeParse({ plan, status });
  if (!p.success) return { error: "Pick a plan and status." };
  const { error } = await db.from("organizations").update(p.data).eq("id", orgId);
  return error ? { error: "Couldn’t save." } : done(locationId, "Account updated.");
}

const STAND = ["standard", "custom", "sticker"] as const;
export async function addOrder(locationId: string, input: { standType: string; quantity: number; notes: string }): Promise<R> {
  const { db } = await requireAdmin();
  const p = z.object({ standType: z.enum(STAND), quantity: z.number().int().min(1).max(500), notes: z.string().trim().max(500) }).safeParse(input);
  if (!p.success) return { error: "Check the quantity (1–500)." };
  const { error } = await db.from("hardware_orders").insert({ location_id: locationId, stand_type: p.data.standType, quantity: p.data.quantity, notes: p.data.notes || null });
  return error ? { error: "Couldn’t add the order." } : done(locationId, "Order added.");
}

export async function setOrderStatus(locationId: string, orderId: string, status: string): Promise<R> {
  const { db } = await requireAdmin();
  if (!["ordered", "encoded", "shipped", "installed"].includes(status)) return { error: "Unknown status." };
  const { error } = await db.from("hardware_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId).eq("location_id", locationId);
  return error ? { error: "Couldn’t update." } : done(locationId);
}

export async function deleteOrder(locationId: string, orderId: string): Promise<R> {
  const { db } = await requireAdmin();
  await db.from("hardware_orders").delete().eq("id", orderId).eq("location_id", locationId);
  return done(locationId);
}

/** Extra tags for replacements. They start as spares the restaurant can put on any table. */
export async function addSpareTags(locationId: string, count: number): Promise<R> {
  const { db, user } = await requireAdmin();
  const n = Math.round(count);
  if (!(n >= 1 && n <= 50)) return { error: "Add between 1 and 50 tags." };
  const { data: batch } = await db.from("tag_batches").insert({ quantity: n, note: "Spares", created_by: user.id }).select("id").single();
  const rows = Array.from({ length: n }, () => ({ code: newTagCode(), batch_id: batch?.id ?? null, location_id: locationId, status: "unassigned" as const }));
  const { error } = await db.from("tags").insert(rows);
  return error ? { error: "Couldn’t create tags. Try again." } : done(locationId, `Added ${n} spare tag${n > 1 ? "s" : ""}.`);
}

/** A lost or stolen tag stops working right away. It can be turned back on later as a spare. */
export async function setTagEnabled(locationId: string, code: string, enabled: boolean): Promise<R> {
  const { db } = await requireAdmin();
  const update = enabled ? { status: "unassigned" as const } : { status: "disabled" as const, table_id: null };
  const { error } = await db.from("tags").update(update).eq("code", code).eq("location_id", locationId);
  return error ? { error: "Couldn’t update the tag." } : done(locationId, enabled ? `Tag ${code} is a spare again.` : `Tag ${code} is disabled. Tapping it now shows “not set up”.`);
}
