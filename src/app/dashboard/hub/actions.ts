"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLocation } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FormState } from "@/app/login/actions";

const url = z.union([z.literal(""), z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "Links must start with http:// or https://")]);
const BUTTONS = ["menu", "server", "wifi", "review", "loyalty", "instagram", "tiktok"] as const;

const Hub = z.object({
  name: z.string().trim().min(2, "Enter the restaurant name").max(80),
  tagline: z.string().trim().max(120),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a brand color"),
  special: z.string().trim().max(200),
  special_es: z.string().trim().max(200),
  wifi_name: z.string().trim().max(64),
  wifi_password: z.string().max(64),
  google_review_url: url,
  instagram_url: url,
  tiktok_url: url,
  loyalty_goal: z.coerce.number().int().min(3).max(20),
  loyalty_reward: z.string().trim().min(2).max(80),
  theme: z.enum(["light", "dark"]).default("light"),
});

/** Saves the hub. Uses the signed-in user's database access, so the security rules decide who may edit. */
export async function saveHub(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/hub", { edit: true });
  const parsed = Hub.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const v = parsed.data;
  const buttons = Object.fromEntries(BUTTONS.map((b) => [b, f.get(`btn_${b}`) === "on"]));
  const nul = (s: string) => (s === "" ? null : s);

  const { error: e1 } = await ctx.db.from("locations")
    .update({ name: v.name, tagline: nul(v.tagline), brand_color: v.brand_color }).eq("id", ctx.location.id);
  const { error: e2 } = await ctx.db.from("hub_settings").update({
    special: nul(v.special), special_es: nul(v.special_es), wifi_name: nul(v.wifi_name), wifi_password: nul(v.wifi_password),
    google_review_url: nul(v.google_review_url), instagram_url: nul(v.instagram_url), tiktok_url: nul(v.tiktok_url),
    buttons, theme: v.theme, loyalty_goal: v.loyalty_goal, loyalty_reward: v.loyalty_reward, updated_at: new Date().toISOString(),
  }).eq("location_id", ctx.location.id);
  if (e1 || e2) return { error: "Couldn’t save. Please try again." };
  revalidatePath("/dashboard/hub");
  return { message: "Saved. Every table shows the new version now." };
}

const MAX = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function uploadLogo(_: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireLocation("/dashboard/hub", { edit: true });
  const file = f.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (!TYPES[file.type]) return { error: "Use a PNG, JPG or WebP image." };
  if (file.size > MAX) return { error: "That image is over 2 MB. Try a smaller one." };

  const path = `${ctx.location.id}/${Date.now()}.${TYPES[file.type]}`;
  const storage = supabaseAdmin().storage.from("logos");
  const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: "Upload failed. Please try again." };
  const { data } = storage.getPublicUrl(path);
  const { error: e2 } = await ctx.db.from("locations").update({ logo_url: data.publicUrl }).eq("id", ctx.location.id);
  if (e2) return { error: "Couldn’t save the logo." };
  await removeOldLogo(ctx.location.logo_url);
  revalidatePath("/dashboard/hub");
  return { message: "Logo updated." };
}

export async function removeLogo(): Promise<void> {
  const ctx = await requireLocation("/dashboard/hub", { edit: true });
  await ctx.db.from("locations").update({ logo_url: null }).eq("id", ctx.location.id);
  await removeOldLogo(ctx.location.logo_url);
  revalidatePath("/dashboard/hub");
}

async function removeOldLogo(oldUrl: string | null) {
  const marker = "/storage/v1/object/public/logos/";
  if (!oldUrl?.includes(marker)) return;
  await supabaseAdmin().storage.from("logos").remove([oldUrl.split(marker)[1]]).catch(() => {});
}
