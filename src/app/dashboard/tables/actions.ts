"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLocation } from "@/lib/auth/session";
import type { FormState } from "@/app/login/actions";

const label = z.string().trim().min(1, "Give the table a name or number").max(24, "Keep table names under 24 characters");
const section = z.string().trim().max(12);
const done = (msg: string): FormState => { revalidatePath("/dashboard/tables"); return { message: msg }; };
const dupe = (e: { code?: string } | null) => e?.code === "23505";

/** Every action re-checks that the table belongs to this person's restaurant. */
async function ownTable(ctx: Awaited<ReturnType<typeof requireLocation>>, tableId: string) {
  const { data } = await ctx.db.from("dining_tables").select("id, label").eq("id", tableId).eq("location_id", ctx.location.id).maybeSingle();
  return data;
}

export async function addTable(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/tables", { edit: true });
  const p = z.object({ label, section }).safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const { count } = await ctx.db.from("dining_tables").select("id", { count: "exact", head: true }).eq("location_id", ctx.location.id);
  const { error } = await ctx.db.from("dining_tables").insert({ location_id: ctx.location.id, label: p.data.label, section: p.data.section || null, sort_order: (count ?? 0) + 1 });
  if (dupe(error)) return { error: `You already have a table called “${p.data.label}”.` };
  if (error) return { error: "Couldn’t add the table." };
  return done(`Added table ${p.data.label}. Assign it a spare tag below, or ask TapTab for a new stand.`);
}

export async function updateTable(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/tables", { edit: true });
  const p = z.object({ id: z.string().uuid(), label, section }).safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!(await ownTable(ctx, p.data.id))) return { error: "Table not found." };
  const { error } = await ctx.db.from("dining_tables").update({ label: p.data.label, section: p.data.section || null }).eq("id", p.data.id);
  if (dupe(error)) return { error: `You already have a table called “${p.data.label}”.` };
  if (error) return { error: "Couldn’t save." };
  return done("Saved.");
}

/**
 * Put a tag on a different table. If that table already has a tag, the two swap,
 * so a broken stand can be replaced with a spare without losing either tag.
 */
export async function moveTag(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/tables", { edit: true });
  const p = z.object({ code: z.string().regex(/^[A-Z0-9]{6,10}$/), tableId: z.string().uuid() }).safeParse(Object.fromEntries(f));
  if (!p.success) return { error: "Pick a table." };
  const target = await ownTable(ctx, p.data.tableId);
  if (!target) return { error: "Table not found." };
  const { data: tag } = await ctx.db.from("tags").select("code, table_id").eq("code", p.data.code).eq("location_id", ctx.location.id).maybeSingle();
  if (!tag) return { error: "Tag not found." };
  if (tag.table_id === target.id) return { message: "That tag is already on this table." };

  const { data: occupant } = await ctx.db.from("tags").select("code").eq("table_id", target.id).eq("status", "assigned").maybeSingle();
  if (occupant) {
    const swap = tag.table_id
      ? { table_id: tag.table_id, status: "assigned" }
      : { table_id: null, status: "unassigned" };
    const { error } = await ctx.db.from("tags").update(swap).eq("code", occupant.code);
    if (error) return { error: "Couldn’t move the tag." };
  }
  const { error } = await ctx.db.from("tags").update({ table_id: target.id, status: "assigned" }).eq("code", tag.code);
  if (error) return { error: "Couldn’t move the tag." };
  const from = tag.table_id ? (await ctx.db.from("dining_tables").select("label").eq("id", tag.table_id).maybeSingle()).data?.label : null;
  return done(occupant && from
    ? `Swapped: table ${target.label} now has tag ${tag.code}, and table ${from} now has tag ${occupant.code}.`
    : `Done: table ${target.label} now has tag ${tag.code}.`);
}

/** Removes a table. Its tag becomes a spare that can go on another table. */
export async function deleteTable(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/tables", { edit: true });
  const id = String(f.get("id") ?? "");
  const table = await ownTable(ctx, id);
  if (!table) return { error: "Table not found." };
  await ctx.db.from("tags").update({ table_id: null, status: "unassigned" }).eq("table_id", id);
  const { error } = await ctx.db.from("dining_tables").delete().eq("id", id);
  if (error) return { error: "Couldn’t remove the table." };
  return done(`Removed table ${table.label}. Its tag is now a spare.`);
}
