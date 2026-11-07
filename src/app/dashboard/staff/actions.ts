"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLocation } from "@/lib/auth/session";
import { sendSms, toE164 } from "@/lib/sms";

export type R = { ok?: true; error?: string; message?: string };
const done = (message?: string): R => { revalidatePath("/dashboard/staff"); revalidatePath("/dashboard/live"); return { ok: true, message }; };
const ctxFor = () => requireLocation("/dashboard/staff", { edit: true });
const sections = (raw: string) => [...new Set(raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 12);

const Staff = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Enter a name").max(40),
  phone: z.string().trim().min(7, "Enter a mobile number"),
  sections: z.string().max(60).default(""),
  alerts: z.boolean().default(true),
});

export async function saveStaff(input: z.input<typeof Staff>): Promise<R> {
  const ctx = await ctxFor();
  const p = Staff.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const phone = toE164(p.data.phone);
  if (!phone) return { error: "Enter a 10-digit US mobile number." };
  const row = { name: p.data.name, phone_e164: phone, sections: sections(p.data.sections), alerts_on: p.data.alerts };
  const q = p.data.id
    ? ctx.db.from("staff_contacts").update(row).eq("id", p.data.id).eq("location_id", ctx.location.id)
    : ctx.db.from("staff_contacts").insert({ ...row, location_id: ctx.location.id });
  const { error } = await q;
  return error ? { error: "Couldn’t save." } : done(p.data.id ? "Saved." : `Added ${p.data.name}.`);
}

export async function deleteStaff(id: string): Promise<R> {
  const ctx = await ctxFor();
  const { error } = await ctx.db.from("staff_contacts").delete().eq("id", id).eq("location_id", ctx.location.id);
  return error ? { error: "Couldn’t remove." } : done();
}

export async function testText(id: string): Promise<R> {
  const ctx = await ctxFor();
  const { data } = await ctx.db.from("staff_contacts").select("name, phone_e164").eq("id", id).eq("location_id", ctx.location.id).maybeSingle();
  if (!data) return { error: "Not found." };
  const r = await sendSms(data.phone_e164, `TapTab · ${ctx.location.name}: test alert for ${data.name}. Table requests will look like this.`);
  if (r === "skipped") return { error: "Text alerts aren’t switched on yet. They start once TapTab’s text service is approved." };
  return r === "sent" ? { message: `Test text sent to ${data.name}.` } : { error: "The text didn’t go through. Check the number." };
}
