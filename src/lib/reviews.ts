import "server-only";
import { askClaude, AIError } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessToken, listReviews, putReply, STARS, GoogleError } from "@/lib/google";

export type Tone = "friendly" | "warm" | "professional" | "fun";
export type ReviewSettings = { tone: Tone; sign_off: string | null; about: string | null; auto_post_min_stars: number };
export const DEFAULT_SETTINGS: ReviewSettings = { tone: "friendly", sign_off: null, about: null, auto_post_min_stars: 4 };

const TONES: Record<Tone, string> = {
  friendly: "friendly and relaxed, like a neighborhood spot",
  warm: "warm and heartfelt, like a family-run place",
  professional: "polished and professional",
  fun: "upbeat and playful, light emoji allowed (max one)",
};

/** Monthly AI reply allowance: Essential gets 10, Pro and Business (and anyone on a free period) are unlimited. */
export async function aiAllowance(orgId: string, locationId: string) {
  const db = supabaseAdmin();
  const { data: org } = await db.from("organizations").select("plan, free_until").eq("id", orgId).maybeSingle();
  const free = !!org?.free_until && new Date(org.free_until) > new Date();
  const limit = org?.plan === "essential" && !free ? 10 : Infinity;
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const { count } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("location_id", locationId).gte("draft_at", start.toISOString());
  return { used: count ?? 0, limit, left: limit - (count ?? 0) };
}

/** Write a reply to one review in the restaurant's voice. */
export async function draftReply(input: {
  restaurant: string; settings: ReviewSettings; author?: string | null; stars?: number | null; comment?: string | null; menu?: string[];
}): Promise<{ reply: string; language: string }> {
  const s = input.settings;
  const system = `You write replies to Google reviews on behalf of ${input.restaurant}${s.about ? ` (${s.about})` : ""}.
Voice: ${TONES[s.tone]}. Write as the restaurant team ("we"), never as an AI.
Rules:
- Reply in the same language as the review (English if there is no text).
- 2–4 sentences, under 600 characters. No hashtags, no marketing slogans, no discounts or promises you can't keep.
- Thank them by first name if a name is given. Mention one specific thing they said (a dish, the staff, the wait).
- 4–5 stars: grateful, invite them back. 3 stars: thank them, acknowledge what fell short.
- 1–2 stars: apologize sincerely without arguing or blaming, don't repeat accusations, invite them to reach out so you can make it right. Never reveal private details.
- Never invent facts about the visit, staff names, or menu items that aren't mentioned or listed.
${s.sign_off ? `- End with the sign-off on its own line: ${s.sign_off}` : ""}
${input.menu?.length ? `Menu items (for spelling only): ${input.menu.slice(0, 60).join(", ")}` : ""}`;
  const review = `Reviewer: ${input.author || "a guest"}\nStars: ${input.stars ?? "not given"}\nReview: ${input.comment?.trim() || "(no text, rating only)"}`;
  const r = await askClaude<{ reply: string; language: string }>({
    job: "fast", system, maxTokens: 1200,
    content: [{ type: "text", text: review }],
    tool: { name: "review_reply", description: "The reply to post on Google.", input_schema: {
      type: "object", required: ["reply", "language"],
      properties: { reply: { type: "string", description: "The reply text, ready to post" }, language: { type: "string", description: "ISO code of the reply language, e.g. en, es" } },
    } },
  });
  if (!r?.reply?.trim()) throw new AIError("The AI didn’t write a reply. Please try again.");
  return { reply: r.reply.trim().slice(0, 4000), language: r.language || "en" };
}

/** Write a short Google Business Profile post from the menu or a special. */
export async function draftPost(input: { restaurant: string; settings: ReviewSettings; idea?: string; menu: string[] }) {
  const r = await askClaude<{ post: string }>({
    job: "fast", maxTokens: 800,
    system: `You write short Google Business Profile posts for ${input.restaurant}${input.settings.about ? ` (${input.settings.about})` : ""}. Voice: ${TONES[input.settings.tone]}.
2–3 sentences, under 700 characters, no hashtags, one clear reason to visit this week. Only mention dishes from this menu: ${input.menu.slice(0, 80).join(", ") || "(menu not loaded; keep it general)"}.`,
    content: [{ type: "text", text: input.idea?.trim() ? `Topic: ${input.idea}` : "Pick a dish worth featuring this week." }],
    tool: { name: "google_post", description: "The post text.", input_schema: { type: "object", required: ["post"], properties: { post: { type: "string" } } } },
  });
  return r.post.trim().slice(0, 1500);
}

export async function menuNames(locationId: string) {
  const db = supabaseAdmin();
  const { data: menu } = await db.from("menus").select("id").eq("location_id", locationId).eq("active", true).maybeSingle();
  if (!menu) return [];
  const { data: cats } = await db.from("menu_categories").select("id").eq("menu_id", menu.id);
  if (!cats?.length) return [];
  const { data } = await db.from("menu_items").select("name").in("category_id", cats.map((c) => c.id)).limit(200);
  return (data ?? []).map((i: any) => i.name?.en).filter(Boolean) as string[];
}

/**
 * Pull new Google reviews for one restaurant, draft replies, and post the ones the owner allowed
 * to go out automatically. Safe to run repeatedly.
 */
export async function syncLocation(locationId: string): Promise<{ added: number; drafted: number; posted: number; error?: string }> {
  const db = supabaseAdmin();
  const { data: conn } = await db.from("google_connections").select("*").eq("location_id", locationId).maybeSingle();
  if (!conn?.account_name || !conn.location_name) return { added: 0, drafted: 0, posted: 0, error: "Choose which Google listing to use first." };
  const [{ data: loc }, { data: set }] = await Promise.all([
    db.from("locations").select("name, org_id").eq("id", locationId).single(),
    db.from("review_settings").select("*").eq("location_id", locationId).maybeSingle(),
  ]);
  const settings: ReviewSettings = { ...DEFAULT_SETTINGS, ...(set ?? {}) };
  let added = 0, drafted = 0, posted = 0;
  try {
    const at = await accessToken(conn.refresh_token);
    const reviews = await listReviews(at, conn.account_name, conn.location_name, 100);
    const { data: known } = await db.from("reviews").select("google_name, status").in("google_name", reviews.map((r) => r.name));
    const seen = new Map((known ?? []).map((k) => [k.google_name, k.status]));
    for (const g of reviews) {
      if (seen.has(g.name)) {
        // Replied on Google directly since we last looked.
        if (g.reviewReply && seen.get(g.name) !== "posted")
          await db.from("reviews").update({ reply: g.reviewReply.comment, replied_at: g.reviewReply.updateTime, reply_by: "google", status: "posted" }).eq("google_name", g.name);
        continue;
      }
      await db.from("reviews").insert({
        location_id: locationId, source: "google", google_name: g.name, author: g.reviewer?.isAnonymous ? null : g.reviewer?.displayName ?? null,
        stars: STARS[g.starRating ?? ""] ?? null, comment: g.comment ?? null, reviewed_at: g.createTime,
        ...(g.reviewReply ? { reply: g.reviewReply.comment, replied_at: g.reviewReply.updateTime, reply_by: "google", status: "posted" } : {}),
      });
      added++;
    }
    // Draft (and maybe post) anything still unanswered, oldest first, within the plan allowance.
    const { data: open } = await db.from("reviews").select("*").eq("location_id", locationId).eq("source", "google").eq("status", "new").order("reviewed_at").limit(25);
    const menu = open?.length ? await menuNames(locationId) : [];
    for (const r of open ?? []) {
      if ((await aiAllowance(loc!.org_id, locationId)).left <= 0) break;
      const d = await draftReply({ restaurant: loc!.name, settings, author: r.author, stars: r.stars, comment: r.comment, menu });
      drafted++;
      const auto = (r.stars ?? 0) >= settings.auto_post_min_stars;
      if (auto) {
        await putReply(at, r.google_name!, d.reply);
        await db.from("reviews").update({ draft: d.reply, draft_at: new Date().toISOString(), language: d.language, reply: d.reply, replied_at: new Date().toISOString(), reply_by: "auto", status: "posted", error: null }).eq("id", r.id);
        posted++;
      } else {
        await db.from("reviews").update({ draft: d.reply, draft_at: new Date().toISOString(), language: d.language, status: "needs_approval" }).eq("id", r.id);
      }
    }
    await db.from("google_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("location_id", locationId);
    return { added, drafted, posted };
  } catch (e) {
    const msg = e instanceof GoogleError || e instanceof AIError ? e.message : "Sync failed.";
    console.error("[reviews] sync", locationId, e);
    await db.from("google_connections").update({ last_sync_at: new Date().toISOString(), last_error: msg }).eq("location_id", locationId);
    return { added, drafted, posted, error: msg };
  }
}

/** Post one approved reply to Google. */
export async function postReply(locationId: string, reviewId: string, text: string) {
  const db = supabaseAdmin();
  const [{ data: conn }, { data: r }] = await Promise.all([
    db.from("google_connections").select("refresh_token").eq("location_id", locationId).maybeSingle(),
    db.from("reviews").select("google_name, source").eq("id", reviewId).eq("location_id", locationId).maybeSingle(),
  ]);
  if (!r) throw new GoogleError("Review not found.");
  if (r.source !== "google" || !r.google_name) throw new GoogleError("This review was added by hand: copy the reply and post it on Google yourself.");
  if (!conn) throw new GoogleError("Connect your Google Business Profile first.");
  await putReply(await accessToken(conn.refresh_token), r.google_name, text);
}
