"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LeadState = { ok?: true; error?: string };

const Lead = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  restaurant: z.string().trim().min(2, "Enter your business name").max(120),
  email: z.union([z.literal(""), z.string().trim().email("Check your email address")]),
  phone: z.string().trim().max(30),
  tables: z.union([z.literal(""), z.coerce.number().int().min(1).max(500)]),
  message: z.string().trim().max(1000),
  company: z.string().max(0).optional(), // honeypot: real people leave it empty
});

/** "Book a demo" form on the landing page. Saves a lead for the TapTab admin panel. */
export async function submitLead(_: LeadState, f: FormData): Promise<LeadState> {
  const p = Lead.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  if (!v.email && v.phone.replace(/\D/g, "").length < 10) return { error: "Add an email or a phone number so we can reach you." };
  const db = supabaseAdmin();
  // Light flood guard: at most 3 requests from the same email or phone per hour.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const contact = v.email || v.phone;
  const { count } = await db.from("leads").select("id", { count: "exact", head: true })
    .gte("created_at", since).or(`email.eq.${JSON.stringify(contact)},phone.eq.${JSON.stringify(contact)}`);
  if ((count ?? 0) >= 3) return { ok: true };
  const ua = (await headers()).get("user-agent")?.slice(0, 120) ?? "";
  const { error } = await db.from("leads").insert({
    name: v.name, restaurant: v.restaurant, email: v.email || null, phone: v.phone || null,
    tables: v.tables === "" ? null : v.tables, message: [v.message, ua && `\n\n(${ua})`].filter(Boolean).join("") || null,
  });
  return error ? { error: "That didn’t go through. Please try again in a minute." } : { ok: true };
}
