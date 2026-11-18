"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLocation } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AIError } from "@/lib/ai";
import { GoogleError, accessToken, createPost, listLocations } from "@/lib/google";
import { aiAllowance, draftPost, draftReply, menuNames, postReply, syncLocation, DEFAULT_SETTINGS, type ReviewSettings } from "@/lib/reviews";

type R = { ok?: boolean; error?: string; msg?: string; text?: string };
const PATH = "/dashboard/reviews";
const fail = (e: unknown): R => ({ error: e instanceof AIError || e instanceof GoogleError ? e.message : "Something went wrong. Please try again." });

async function ctx() {
  const c = await requireLocation(PATH, { edit: true });
  const { data } = await c.db.from("review_settings").select("*").eq("location_id", c.location.id).maybeSingle();
  return { ...c, settings: { ...DEFAULT_SETTINGS, ...(data ?? {}) } as ReviewSettings };
}

export async function saveSettings(input: { tone: string; sign_off: string; about: string; auto_post_min_stars: number }): Promise<R> {
  const { db, location } = await requireLocation(PATH, { edit: true });
  const p = z.object({
    tone: z.enum(["friendly", "warm", "professional", "fun"]), sign_off: z.string().trim().max(80), about: z.string().trim().max(200),
    auto_post_min_stars: z.number().int().min(1).max(6),
  }).safeParse(input);
  if (!p.success) return { error: "Check the settings and try again." };
  const { error } = await db.from("review_settings").upsert({ location_id: location.id, ...p.data, sign_off: p.data.sign_off || null, about: p.data.about || null, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn’t save." };
  revalidatePath(PATH);
  return { ok: true, msg: "Saved." };
}

/** "Draft a reply": owner pastes a review from Google, AI writes the reply. Saved so it shows in the inbox and stats. */
export async function draftManual(input: { author: string; stars: number; comment: string }): Promise<R> {
  const { location, settings, orgId } = await ctx();
  const p = z.object({ author: z.string().trim().max(80), stars: z.number().int().min(1).max(5), comment: z.string().trim().max(4000) }).safeParse(input);
  if (!p.success) return { error: "Pick a star rating." };
  const allow = await aiAllowance(orgId, location.id);
  if (allow.left <= 0) return { error: `You’ve used all ${allow.limit} AI replies this month. Upgrade to Pro for unlimited replies.` };
  try {
    const d = await draftReply({ restaurant: location.name, settings, author: p.data.author, stars: p.data.stars, comment: p.data.comment, menu: await menuNames(location.id) });
    await supabaseAdmin().from("reviews").insert({
      location_id: location.id, source: "manual", author: p.data.author || null, stars: p.data.stars, comment: p.data.comment || null,
      reviewed_at: new Date().toISOString(), draft: d.reply, draft_at: new Date().toISOString(), language: d.language, status: "drafted",
    });
    revalidatePath(PATH);
    return { ok: true, text: d.reply };
  } catch (e) { return fail(e); }
}

export async function regenerate(id: string): Promise<R> {
  const { db, location, settings, orgId } = await ctx();
  const { data: r } = await db.from("reviews").select("*").eq("id", id).eq("location_id", location.id).maybeSingle();
  if (!r) return { error: "Review not found." };
  const allow = await aiAllowance(orgId, location.id);
  if (allow.left <= 0) return { error: `You’ve used all ${allow.limit} AI replies this month.` };
  try {
    const d = await draftReply({ restaurant: location.name, settings, author: r.author, stars: r.stars, comment: r.comment, menu: await menuNames(location.id) });
    await db.from("reviews").update({ draft: d.reply, draft_at: new Date().toISOString(), language: d.language, status: r.source === "google" ? "needs_approval" : "drafted" }).eq("id", id);
    revalidatePath(PATH);
    return { ok: true, text: d.reply };
  } catch (e) { return fail(e); }
}

/** Approve: post to Google (Google reviews) or mark as posted (reviews added by hand, after the owner pasted it on Google). */
export async function approve(id: string, text: string): Promise<R> {
  const { db, location } = await requireLocation(PATH, { edit: true });
  const reply = text.trim().slice(0, 4000);
  if (!reply) return { error: "The reply is empty." };
  const { data: r } = await db.from("reviews").select("source").eq("id", id).eq("location_id", location.id).maybeSingle();
  if (!r) return { error: "Review not found." };
  try {
    if (r.source === "google") await postReply(location.id, id, reply);
    await db.from("reviews").update({ draft: reply, reply, replied_at: new Date().toISOString(), reply_by: "owner", status: "posted", error: null }).eq("id", id);
    revalidatePath(PATH);
    return { ok: true, msg: r.source === "google" ? "Posted on Google." : "Marked as posted." };
  } catch (e) { return fail(e); }
}

export async function skip(id: string): Promise<R> {
  const { db, location } = await requireLocation(PATH, { edit: true });
  await db.from("reviews").update({ status: "skipped" }).eq("id", id).eq("location_id", location.id);
  revalidatePath(PATH);
  return { ok: true };
}

export async function syncNow(): Promise<R> {
  const { location } = await requireLocation(PATH, { edit: true });
  const r = await syncLocation(location.id);
  revalidatePath(PATH);
  if (r.error) return { error: r.error };
  return { ok: true, msg: r.added || r.posted || r.drafted ? `${r.added} new review${r.added === 1 ? "" : "s"}, ${r.drafted} replies written, ${r.posted} posted.` : "You’re up to date." };
}

export async function chooseListing(value: string): Promise<R> {
  const { location } = await requireLocation(PATH, { edit: true });
  const [account, name, ...title] = value.split("|");
  if (!account?.startsWith("accounts/") || !name?.startsWith("locations/")) return { error: "Pick a listing." };
  await supabaseAdmin().from("google_connections").update({ account_name: account, location_name: name, location_title: title.join("|") || null }).eq("location_id", location.id);
  revalidatePath(PATH);
  return { ok: true, msg: "Listing saved. Syncing reviews…" };
}

export async function listListings(): Promise<{ error?: string; items?: { value: string; label: string }[] }> {
  const { location } = await requireLocation(PATH, { edit: true });
  const { data: conn } = await supabaseAdmin().from("google_connections").select("refresh_token").eq("location_id", location.id).maybeSingle();
  if (!conn) return { error: "Not connected." };
  try {
    const all = await listLocations(await accessToken(conn.refresh_token));
    return { items: all.map((l) => ({ value: `${l.account}|${l.name}|${l.title}`, label: `${l.title}${l.address ? ` · ${l.address}` : ""}` })) };
  } catch (e) { return { error: e instanceof GoogleError ? e.message : "Couldn’t load your Google listings." }; }
}

export async function disconnect(): Promise<R> {
  const { location } = await requireLocation(PATH, { edit: true });
  await supabaseAdmin().from("google_connections").delete().eq("location_id", location.id);
  revalidatePath(PATH);
  return { ok: true, msg: "Disconnected from Google." };
}

export async function writePost(idea: string): Promise<R> {
  const { location, settings, orgId } = await ctx();
  const allow = await aiAllowance(orgId, location.id);
  if (allow.limit !== Infinity) return { error: "Google posts are part of Pro. Upgrade to write posts with AI." };
  try { return { ok: true, text: await draftPost({ restaurant: location.name, settings, idea, menu: await menuNames(location.id) }) }; }
  catch (e) { return fail(e); }
}

export async function publishPost(text: string): Promise<R> {
  const { location } = await requireLocation(PATH, { edit: true });
  const { data: conn } = await supabaseAdmin().from("google_connections").select("refresh_token, account_name, location_name").eq("location_id", location.id).maybeSingle();
  if (!conn?.location_name) return { error: "Connect your Google Business Profile first, or copy the post and add it on Google." };
  try { await createPost(await accessToken(conn.refresh_token), conn.account_name!, conn.location_name, text.trim().slice(0, 1500)); return { ok: true, msg: "Posted on Google." }; }
  catch (e) { return fail(e); }
}
