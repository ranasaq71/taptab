"use server";
import { ModGroupsSchema } from "@/lib/modifiers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLocation } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { askClaude, AIError } from "@/lib/ai";

export type Result = { ok?: true; error?: string; message?: string };
const TAGS = ["veg", "vegan", "gf", "hot"] as const;
const refresh = (message?: string): Result => { revalidatePath("/dashboard/menu"); return { ok: true, message }; };
const ctxFor = () => requireLocation("/dashboard/menu", { edit: true });
type Ctx = Awaited<ReturnType<typeof ctxFor>>;

async function menuId(ctx: Ctx): Promise<string> {
  const { data } = await ctx.db.from("menus").select("id").eq("location_id", ctx.location.id).eq("active", true).order("created_at").limit(1).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await ctx.db.from("menus").insert({ location_id: ctx.location.id }).select("id").single();
  if (error || !created) throw new Error("Could not create a menu");
  return created.id;
}
async function ownCategory(ctx: Ctx, id: string) {
  const { data } = await ctx.db.from("menu_categories").select("id, menu_id, sort_order, menus!inner(location_id)").eq("id", id).eq("menus.location_id", ctx.location.id).maybeSingle();
  return data;
}
async function ownItem(ctx: Ctx, id: string) {
  const { data } = await ctx.db.from("menu_items").select("id, category_id, sort_order, photo_url, menu_categories!inner(menus!inner(location_id))").eq("id", id).eq("menu_categories.menus.location_id", ctx.location.id).maybeSingle();
  return data;
}
const loc = (en: string, es?: string) => (es?.trim() ? { en: en.trim(), es: es.trim() } : { en: en.trim() });

// ---------- Categories ----------
const Cat = z.object({
  id: z.string().uuid().optional(), en: z.string().trim().min(1, "Name the category").max(60), es: z.string().trim().max(60).optional(),
  subEn: z.string().trim().max(80).optional(), subEs: z.string().trim().max(80).optional(),
  display: z.enum(["list", "cards"]).default("list"),
});

export async function saveCategory(input: z.input<typeof Cat>): Promise<Result> {
  const ctx = await ctxFor();
  const p = Cat.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.id) {
    if (!(await ownCategory(ctx, p.data.id))) return { error: "Category not found." };
    const { error } = await ctx.db.from("menu_categories").update({ name: loc(p.data.en, p.data.es), subtitle: p.data.subEn ? loc(p.data.subEn, p.data.subEs) : {}, display: p.data.display }).eq("id", p.data.id);
    return error ? { error: "Couldn’t save." } : refresh();
  }
  const mid = await menuId(ctx);
  const { count } = await ctx.db.from("menu_categories").select("id", { count: "exact", head: true }).eq("menu_id", mid);
  const { error } = await ctx.db.from("menu_categories").insert({ menu_id: mid, name: loc(p.data.en, p.data.es), subtitle: p.data.subEn ? loc(p.data.subEn, p.data.subEs) : {}, display: p.data.display, sort_order: (count ?? 0) + 1 });
  return error ? { error: "Couldn’t add the category." } : refresh();
}

export async function deleteCategory(id: string): Promise<Result> {
  const ctx = await ctxFor();
  if (!(await ownCategory(ctx, id))) return { error: "Category not found." };
  const { error } = await ctx.db.from("menu_categories").delete().eq("id", id);
  return error ? { error: "Couldn’t delete." } : refresh();
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<Result> {
  const ctx = await ctxFor();
  const cat = await ownCategory(ctx, id);
  if (!cat) return { error: "Category not found." };
  const { data: all } = await ctx.db.from("menu_categories").select("id, sort_order").eq("menu_id", cat.menu_id).order("sort_order");
  return reorder(ctx, "menu_categories", all ?? [], id, dir);
}

// ---------- Items ----------
const Item = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  nameEn: z.string().trim().min(1, "Name the dish").max(80),
  nameEs: z.string().trim().max(80).optional(),
  descEn: z.string().trim().max(300).optional(),
  descEs: z.string().trim().max(300).optional(),
  price: z.string().trim().regex(/^(\d{1,4}(\.\d{1,2})?)?$/, "Price looks wrong. Use a number like 12.50").optional(),
  tags: z.array(z.enum(TAGS)).default([]),
  heat: z.number().int().min(0).max(3).default(0),
  modifiers: ModGroupsSchema.default([]),
  available: z.boolean().default(true),
});

export async function saveItem(input: z.input<typeof Item>): Promise<Result> {
  const ctx = await ctxFor();
  const p = Item.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  if (!(await ownCategory(ctx, v.categoryId))) return { error: "Category not found." };
  const row = {
    category_id: v.categoryId, name: loc(v.nameEn, v.nameEs),
    description: v.descEn ? loc(v.descEn, v.descEs) : {},
    price_cents: v.price ? Math.round(parseFloat(v.price) * 100) : null,
    // Spice level drives the "Spicy" label, so the filter and flames always agree.
    tags: [...v.tags.filter((t) => t !== "hot"), ...(v.heat > 0 ? ["hot" as const] : [])], heat: v.heat, available: v.available, modifiers: v.modifiers,
  };
  if (v.id) {
    if (!(await ownItem(ctx, v.id))) return { error: "Dish not found." };
    const { error } = await ctx.db.from("menu_items").update(row).eq("id", v.id);
    return error ? { error: "Couldn’t save." } : refresh();
  }
  const { count } = await ctx.db.from("menu_items").select("id", { count: "exact", head: true }).eq("category_id", v.categoryId);
  const { error } = await ctx.db.from("menu_items").insert({ ...row, sort_order: (count ?? 0) + 1 });
  return error ? { error: "Couldn’t add the dish." } : refresh();
}

export async function deleteItem(id: string): Promise<Result> {
  const ctx = await ctxFor();
  const item = await ownItem(ctx, id);
  if (!item) return { error: "Dish not found." };
  await ctx.db.from("menu_items").delete().eq("id", id);
  await removeMedia(item.photo_url);
  return refresh();
}

export async function toggleItem(id: string, available: boolean): Promise<Result> {
  const ctx = await ctxFor();
  if (!(await ownItem(ctx, id))) return { error: "Dish not found." };
  await ctx.db.from("menu_items").update({ available }).eq("id", id);
  return refresh();
}

export async function moveItem(id: string, dir: -1 | 1): Promise<Result> {
  const ctx = await ctxFor();
  const item = await ownItem(ctx, id);
  if (!item) return { error: "Dish not found." };
  const { data: all } = await ctx.db.from("menu_items").select("id, sort_order").eq("category_id", item.category_id).order("sort_order");
  return reorder(ctx, "menu_items", all ?? [], id, dir);
}

async function reorder(ctx: Ctx, table: "menu_items" | "menu_categories", rows: { id: string }[], id: string, dir: -1 | 1): Promise<Result> {
  const i = rows.findIndex((r) => r.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: true };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await Promise.all(rows.map((r, k) => ctx.db.from(table).update({ sort_order: k + 1 }).eq("id", r.id)));
  return refresh();
}

// ---------- Photos & PDF ----------
const IMG: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MEDIA_MARK = "/storage/v1/object/public/menu-media/";

async function putMedia(ctx: Ctx, file: File, kind: string, ext: string) {
  const storage = supabaseAdmin().storage.from("menu-media");
  const path = `${ctx.location.id}/${kind}-${Date.now()}.${ext}`;
  const { error } = await storage.upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return storage.getPublicUrl(path).data.publicUrl;
}
async function removeMedia(url: string | null | undefined) {
  if (!url?.includes(MEDIA_MARK)) return;
  await supabaseAdmin().storage.from("menu-media").remove([url.split(MEDIA_MARK)[1]]).catch(() => {});
}

export async function uploadItemPhoto(f: FormData): Promise<Result> {
  const ctx = await ctxFor();
  const item = await ownItem(ctx, String(f.get("itemId") ?? ""));
  const file = f.get("photo");
  if (!item) return { error: "Dish not found." };
  if (!(file instanceof File) || !IMG[file.type]) return { error: "Use a PNG, JPG or WebP photo." };
  if (file.size > 4 * 1024 * 1024) return { error: "That photo is over 4 MB." };
  try {
    const url = await putMedia(ctx, file, "dish", IMG[file.type]);
    await ctx.db.from("menu_items").update({ photo_url: url }).eq("id", item.id);
    await removeMedia(item.photo_url);
  } catch { return { error: "Upload failed. Please try again." }; }
  return refresh();
}

export async function removeItemPhoto(id: string): Promise<Result> {
  const ctx = await ctxFor();
  const item = await ownItem(ctx, id);
  if (!item) return { error: "Dish not found." };
  await ctx.db.from("menu_items").update({ photo_url: null }).eq("id", id);
  await removeMedia(item.photo_url);
  return refresh();
}

export async function uploadMenuPdf(f: FormData): Promise<Result> {
  const ctx = await ctxFor();
  const file = f.get("pdf");
  if (!(file instanceof File) || file.type !== "application/pdf") return { error: "Choose a PDF file." };
  if (file.size > 4 * 1024 * 1024) return { error: "That PDF is over 4 MB. Try compressing it first." };
  const mid = await menuId(ctx);
  const { data: old } = await ctx.db.from("menus").select("pdf_url").eq("id", mid).single();
  try {
    const url = await putMedia(ctx, file, "menu", "pdf");
    await ctx.db.from("menus").update({ pdf_url: url }).eq("id", mid);
    await removeMedia(old?.pdf_url);
  } catch { return { error: "Upload failed. Please try again." }; }
  return refresh("PDF uploaded. Guests see a “View full menu (PDF)” button.");
}

export async function removeMenuPdf(): Promise<Result> {
  const ctx = await ctxFor();
  const mid = await menuId(ctx);
  const { data: old } = await ctx.db.from("menus").select("pdf_url").eq("id", mid).single();
  await ctx.db.from("menus").update({ pdf_url: null }).eq("id", mid);
  await removeMedia(old?.pdf_url);
  return refresh();
}

// ---------- AI import ----------
export type Draft = { categories: { name: string; items: { name: string; description?: string; price?: number | null; tags?: string[] }[] }[] };

const EXTRACT_TOOL = {
  name: "save_menu",
  description: "Save the dishes found on the menu.",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Section heading as printed, e.g. Starters" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string", description: "Short description as printed; empty if none" },
                  price: { type: ["number", "null"], description: "Price in dollars, e.g. 12.5; null if not shown" },
                  tags: { type: "array", items: { type: "string", enum: [...TAGS] }, description: "Only labels the menu itself shows" },
                },
                required: ["name"],
              },
            },
          },
          required: ["name", "items"],
        },
      },
    },
    required: ["categories"],
  },
};

/** Reads a menu photo or PDF and returns a draft for the owner to review. Nothing is saved yet. */
export async function aiReadMenu(f: FormData): Promise<Result & { draft?: Draft }> {
  await ctxFor();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo or PDF of the menu." };
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !IMG[file.type]) return { error: "Use a photo (JPG, PNG, WebP) or a PDF." };
  if (file.size > 4 * 1024 * 1024) return { error: "That file is over 4 MB. For PDFs, try one page at a time." };
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const draft = await askClaude<Draft>({
      job: "vision",
      system: [
        "You copy restaurant menus into structured data.",
        "Copy dish names, descriptions and prices exactly as printed. Do not invent dishes, prices or descriptions.",
        "Group dishes under the menu's own section headings; use \"Menu\" if there are none.",
        "Tags: add veg, vegan, gf or hot ONLY when the menu itself marks the dish (a V/VG/GF symbol, a chili icon, a legend, or words like \"vegetarian\" or \"spicy\"). Never guess from ingredients: guests rely on these for allergies and diets.",
        "If a dish has several prices (sizes), use the smallest and mention the sizes in the description.",
      ].join(" "),
      content: [
        isPdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
              : { type: "image", source: { type: "base64", media_type: file.type, data } },
        { type: "text", text: "Extract every dish on this menu." },
      ],
      tool: EXTRACT_TOOL,
    });
    const count = draft.categories?.reduce((n, c) => n + (c.items?.length ?? 0), 0) ?? 0;
    if (!count) return { error: "No dishes found. Try a clearer, straight-on photo." };
    return { ok: true, draft, message: `Found ${count} dishes in ${draft.categories.length} sections. Check them, then add them to your menu.` };
  } catch (e) {
    return { error: e instanceof AIError ? e.message : "Couldn’t read the menu. Please try again." };
  }
}

const DraftSchema = z.object({
  categories: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    items: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(300).optional().nullable(),
      price: z.number().min(0).max(9999).optional().nullable(),
      tags: z.array(z.string()).optional().nullable(),
    })).max(200),
  })).max(40),
});

/** Saves a reviewed draft. "replace" clears the current menu first. */
export async function aiSaveDraft(draft: Draft, mode: "add" | "replace"): Promise<Result> {
  const ctx = await ctxFor();
  const p = DraftSchema.safeParse(draft);
  if (!p.success) return { error: "The draft looks incomplete. Please read the menu again." };
  const mid = await menuId(ctx);
  if (mode === "replace") await ctx.db.from("menu_categories").delete().eq("menu_id", mid);
  const { count } = await ctx.db.from("menu_categories").select("id", { count: "exact", head: true }).eq("menu_id", mid);
  let order = count ?? 0, dishes = 0;
  for (const c of p.data.categories) {
    if (!c.items.length) continue;
    const { data: cat, error } = await ctx.db.from("menu_categories").insert({ menu_id: mid, name: { en: c.name }, sort_order: ++order }).select("id").single();
    if (error || !cat) return { error: "Saving stopped partway. Check your menu and try again." };
    const rows = c.items.map((i, k) => ({
      category_id: cat.id, name: { en: i.name }, description: i.description ? { en: i.description } : {},
      price_cents: i.price != null ? Math.round(i.price * 100) : null,
      tags: (i.tags ?? []).filter((t): t is (typeof TAGS)[number] => (TAGS as readonly string[]).includes(t)), heat: (i.tags ?? []).includes("hot") ? 1 : 0, sort_order: k + 1,
    }));
    const { error: e2 } = await ctx.db.from("menu_items").insert(rows);
    if (e2) return { error: "Saving stopped partway. Check your menu and try again." };
    dishes += rows.length;
  }
  return refresh(`Added ${dishes} dishes. Use “Translate to Spanish” to fill in the Spanish menu.`);
}

// ---------- AI translation ----------
const TRANSLATE_TOOL = {
  name: "save_translations",
  description: "Save the Spanish translations.",
  input_schema: {
    type: "object",
    properties: { translations: { type: "array", items: { type: "object", properties: { id: { type: "string" }, es: { type: "string" } }, required: ["id", "es"] } } },
    required: ["translations"],
  },
};

/** Fills in Spanish for every category, dish name and description. Existing Spanish is kept unless overwrite is true. */
export async function aiTranslate(overwrite: boolean): Promise<Result> {
  const ctx = await ctxFor();
  const mid = await menuId(ctx);
  const { data: cats } = await ctx.db.from("menu_categories").select("id, name, subtitle, menu_items(id, name, description)").eq("menu_id", mid);
  type Job = { id: string; en: string; apply: (es: string) => PromiseLike<unknown> };
  const jobs: Job[] = [];
  for (const c of cats ?? []) {
    const name = c.name as { en?: string; es?: string };
    if (name.en && (overwrite || !name.es)) jobs.push({ id: `c:${c.id}`, en: name.en, apply: (es) => ctx.db.from("menu_categories").update({ name: { ...name, es } }).eq("id", c.id) });
    const sub = (c.subtitle ?? {}) as { en?: string; es?: string };
    if (sub.en && (overwrite || !sub.es)) jobs.push({ id: `s:${c.id}`, en: sub.en, apply: (es) => ctx.db.from("menu_categories").update({ subtitle: { ...sub, es } }).eq("id", c.id) });
    for (const i of (c.menu_items as any[]) ?? []) {
      const n = i.name as { en?: string; es?: string };
      const d = (i.description ?? {}) as { en?: string; es?: string };
      if (n.en && (overwrite || !n.es)) jobs.push({ id: `n:${i.id}`, en: n.en, apply: (es) => ctx.db.from("menu_items").update({ name: { ...n, es } }).eq("id", i.id) });
      if (d.en && (overwrite || !d.es)) jobs.push({ id: `d:${i.id}`, en: d.en, apply: (es) => ctx.db.from("menu_items").update({ description: { ...d, es } }).eq("id", i.id) });
    }
  }
  if (!jobs.length) return { message: "Everything already has a Spanish version." };
  if (jobs.length > 600) return { error: "This menu is very large. Contact support to translate it." };

  // A dish's name and description are separate jobs; merge them so neither update overwrites the other.
  const byItem = new Map<string, { n?: string; d?: string }>();
  try {
    const out = await askClaude<{ translations: { id: string; es: string }[] }>({
      job: "fast",
      system: "You translate US restaurant menus from English to natural Latin American Spanish as used in Texas. Keep dish names that are proper names or already Spanish/foreign (biryani, tikka masala, pho, tacos) unchanged or lightly adapted. Keep translations short like a printed menu. Return one translation per id.",
      content: [{ type: "text", text: JSON.stringify(jobs.map(({ id, en }) => ({ id, en }))) }],
      tool: TRANSLATE_TOOL,
    });
    const es = new Map(out.translations.map((t) => [t.id, t.es.trim()]));
    let done = 0;
    for (const j of jobs) {
      const t = es.get(j.id);
      if (!t) continue;
      if (j.id.startsWith("c:") || j.id.startsWith("s:")) { await j.apply(t); done++; continue; }
      const key = j.id.slice(2);
      const slot = byItem.get(key) ?? {};
      if (j.id.startsWith("n:")) slot.n = t; else slot.d = t;
      byItem.set(key, slot);
    }
    for (const [itemId, s] of byItem) {
      const { data: cur } = await ctx.db.from("menu_items").select("name, description").eq("id", itemId).single();
      if (!cur) continue;
      const upd: Record<string, unknown> = {};
      if (s.n) upd.name = { ...(cur.name as object), es: s.n };
      if (s.d) upd.description = { ...(cur.description as object), es: s.d };
      await ctx.db.from("menu_items").update(upd).eq("id", itemId);
      done += (s.n ? 1 : 0) + (s.d ? 1 : 0);
    }
    return refresh(`Translated ${done} lines to Spanish. Guests who switch to ES see them now.`);
  } catch (e) {
    return { error: e instanceof AIError ? e.message : "Translation failed. Please try again." };
  }
}
