"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { newTagCode } from "@/lib/site";
import { inviteToOrg } from "@/app/dashboard/team/actions";
import type { FormState } from "@/app/login/actions";

const NewRestaurant = z.object({
  name: z.string().trim().min(2).max(80),
  tables: z.coerce.number().int().min(1).max(150),
  ownerName: z.string().trim().max(80).optional(),
  ownerEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).optional(),
});

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Creates the organization, location, tables, one tag per table, and optionally invites the owner. */
export async function createRestaurant(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = NewRestaurant.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: "Check the name, number of tables (1–150) and email." };
  const { name, tables, ownerName, ownerEmail } = parsed.data;
  const db = supabaseAdmin();

  const { data: org, error: orgErr } = await db.from("organizations").insert({ name }).select("id").single();
  if (orgErr || !org) return { error: orgErr?.message ?? "Could not create the restaurant." };
  let locationId: string;
  try {
    const slug = `${slugify(name)}-${newTagCode(4).toLowerCase()}`;
    const { data: loc, error: locErr } = await db.from("locations").insert({ org_id: org.id, name, slug }).select("id").single();
    if (locErr || !loc) throw locErr ?? new Error("location");

    const rows = Array.from({ length: tables }, (_, i) => ({ location_id: loc.id, label: String(i + 1), sort_order: i + 1 }));
    const { data: created, error: tErr } = await db.from("dining_tables").insert(rows).select("id");
    if (tErr || !created) throw tErr ?? new Error("tables");

    const tags = created.map((t) => ({ code: newTagCode(), location_id: loc.id, table_id: t.id, status: "assigned" as const }));
    const { error: tagErr } = await db.from("tags").insert(tags);
    if (tagErr) throw tagErr;

    if (ownerEmail) {
      const r = await inviteToOrg({ orgId: org.id, name: ownerName, email: ownerEmail, role: "owner" });
      if (r.error) console.error("Owner invite failed:", r.error);
    }
    locationId = loc.id;
  } catch (e: any) {
    await db.from("organizations").delete().eq("id", org.id); // undo partial setup
    return { error: `Setup failed: ${e?.message ?? "unknown error"}` };
  }
  redirect(`/admin/locations/${locationId}`);
}
