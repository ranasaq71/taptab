import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Lang = "en" | "es";
export type Localized = Partial<Record<Lang, string>>;
export type HubButton = "menu" | "server" | "wifi" | "review" | "loyalty" | "instagram" | "tiktok";

export interface HubItem { id: string; name: Localized; description: Localized; priceCents: number | null; tags: string[]; photoUrl: string | null }
export interface HubCategory { id: string; name: Localized; items: HubItem[] }
export interface HubData {
  tagCode: string;
  table: { id: string; label: string };
  location: { id: string; name: string; tagline: string | null; brandColor: string; logoUrl: string | null };
  settings: {
    special: Localized; wifiName: string | null; wifiPassword: string | null;
    googleReviewUrl: string | null; instagramUrl: string | null; tiktokUrl: string | null;
    languages: Lang[]; buttons: Record<HubButton, boolean>;
    loyaltyGoal: number; loyaltyReward: string; theme: "light" | "dark";
  };
  menu: { pdfUrl: string | null; categories: HubCategory[] };
}

export const TAG_CODE = /^[A-Z0-9]{6,10}$/;

/** Everything a guest phone needs after tapping a tag. Returns null for unknown or unassigned tags. */
export async function loadHubByTag(rawCode: string): Promise<HubData | null> {
  const code = rawCode.toUpperCase();
  if (!TAG_CODE.test(code)) return null;
  const db = supabaseAdmin();

  const { data: tag } = await db
    .from("tags")
    .select("code, status, table:dining_tables(id,label), location:locations(id,name,tagline,brand_color,logo_url, hub:hub_settings(*))")
    .eq("code", code)
    .maybeSingle();

  // Supabase types nested one-to-one joins loosely; normalize them here.
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  const table = one(tag?.table as any);
  const loc = one(tag?.location as any);
  const hub = one(loc?.hub as any);
  if (!tag || tag.status !== "assigned" || !table || !loc || !hub) return null;

  const { data: menu } = await db
    .from("menus")
    .select("pdf_url, categories:menu_categories(id,name,sort_order, items:menu_items(id,name,description,price_cents,tags,photo_url,available,sort_order))")
    .eq("location_id", loc.id).eq("active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();

  const bySort = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;
  const categories: HubCategory[] = ((menu?.categories as any[]) ?? []).sort(bySort).map((c) => ({
    id: c.id, name: c.name,
    items: (c.items as any[]).filter((i) => i.available).sort(bySort).map((i) => ({
      id: i.id, name: i.name, description: i.description ?? {}, priceCents: i.price_cents, tags: i.tags ?? [], photoUrl: i.photo_url,
    })),
  })).filter((c) => c.items.length);

  return {
    tagCode: code,
    table: { id: table.id, label: table.label },
    location: { id: loc.id, name: loc.name, tagline: loc.tagline, brandColor: loc.brand_color, logoUrl: loc.logo_url },
    settings: {
      special: { en: hub.special ?? undefined, es: hub.special_es ?? undefined },
      wifiName: hub.wifi_name, wifiPassword: hub.wifi_password,
      googleReviewUrl: hub.google_review_url, instagramUrl: hub.instagram_url, tiktokUrl: hub.tiktok_url ?? null,
      languages: (hub.languages ?? ["en"]) as Lang[],
      buttons: hub.buttons, loyaltyGoal: hub.loyalty_goal, loyaltyReward: hub.loyalty_reward, theme: hub.theme === "dark" ? "dark" : "light",
    },
    menu: { pdfUrl: menu?.pdf_url ?? null, categories },
  };
}

/** Record a guest action. Never throws: analytics must not break the guest page. */
export async function logEvent(h: Pick<HubData, "tagCode" | "table" | "location">, type: string, sessionId?: string, source: "nfc" | "qr" = "nfc") {
  try {
    const db = supabaseAdmin();
    await db.from("events").insert({ location_id: h.location.id, table_id: h.table.id, tag_code: h.tagCode, type, session_id: sessionId ?? null, ...(type === "tap" ? { source } : {}) });
    if (type === "tap") await db.from("tags").update({ last_tap_at: new Date().toISOString() }).eq("code", h.tagCode);
  } catch (e) { console.error("logEvent failed", e); }
}
