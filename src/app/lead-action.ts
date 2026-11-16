"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { sendEmail, esc } from "@/lib/email";
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
  const h = await headers();
  const ua = h.get("user-agent")?.slice(0, 120) ?? "";
  const site = `https://${h.get("x-forwarded-host") ?? h.get("host") ?? "taptab.brandrise.us"}`;
  const { error } = await db.from("leads").insert({
    name: v.name, restaurant: v.restaurant, email: v.email || null, phone: v.phone || null,
    tables: v.tables === "" ? null : v.tables, message: [v.message, ua && `\n\n(${ua})`].filter(Boolean).join("") || null,
  });
  if (error) return { error: "That didn’t go through. Please try again in a minute." };
  // Email the TapTab team after the response is sent, so the guest never waits on it.
  after(() => notifyTeam(v, site));
  return { ok: true };
}

/** New demo request → email to the TapTab inbox (LEADS_TO, default brandrisellc@gmail.com). */
async function notifyTeam(v: z.infer<typeof Lead>, site: string) {
  const rows: [string, string][] = [
    ["Name", v.name], ["Business", v.restaurant], ["Email", v.email || "—"], ["Phone", v.phone || "—"],
    ["Tables or spots", v.tables === "" ? "—" : String(v.tables)], ["Message", v.message || "—"],
  ];
  const when = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
  await sendEmail({
    to: (process.env.LEADS_TO || "brandrisellc@gmail.com").split(",").map((s) => s.trim()),
    subject: `New TapTab demo request: ${v.restaurant}`,
    replyTo: v.email || undefined,
    text: `New demo request from the TapTab website (${when} CT)\n\n${rows.map(([k, x]) => `${k}: ${x}`).join("\n")}\n\nAll requests: ${site}/admin/leads`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#2A0E17">
      <p style="margin:0 0 4px;font-size:13px;color:#6F5960">TapTab website · ${esc(when)} CT</p>
      <h2 style="margin:0 0 16px;font-size:20px">New demo request</h2>
      <table style="border-collapse:collapse;width:100%;font-size:15px">${rows.map(([k, x]) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#6F5960;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;white-space:pre-wrap">${esc(x)}</td></tr>`).join("")}</table>
      <p style="margin:20px 0 0"><a href="${esc(site)}/admin/leads" style="background:#6E1532;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">See all demo requests</a></p>
      ${v.email ? `<p style="margin:16px 0 0;font-size:13px;color:#6F5960">Reply to this email to answer ${esc(v.name)} directly.</p>` : ""}
    </div>`,
  });
}
