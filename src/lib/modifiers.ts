import { z } from "zod";

/** A choice group on a dish, e.g. "Wing Flavor: choose 1" or "Extras: up to 2". Stored in menu_items.modifiers. */
export type Localized = { en?: string; es?: string };
export type ModOption = { name: Localized; priceCents: number };
export type ModGroup = { name: Localized; required: boolean; min: number; max: number; options: ModOption[] };

const L = z.object({ en: z.string().trim().max(60).optional(), es: z.string().trim().max(60).optional() });
export const ModGroupsSchema = z.array(z.object({
  name: L,
  required: z.boolean(),
  min: z.number().int().min(0).max(20),
  max: z.number().int().min(1).max(20),
  options: z.array(z.object({ name: L, priceCents: z.number().int().min(0).max(100000) })).min(1, "Each option group needs at least one option.").max(30),
}).refine((g) => !!g.name.en, "Each option group needs a name.")).max(12);

/** Clean whatever is in the database into the shape the app expects. */
export function readMods(raw: unknown): ModGroup[] {
  const p = ModGroupsSchema.safeParse(raw);
  return p.success ? p.data : [];
}

/** "Choose 1", "Choose up to 2", "Choose 2–3" */
export function ruleText(g: ModGroup, lang: "en" | "es" = "en") {
  const es = lang === "es";
  if (g.required && g.min === g.max) return es ? `Elige ${g.max}` : `Choose ${g.max}`;
  if (!g.required || g.min === 0) return es ? `Opcional · hasta ${g.max}` : `Optional · up to ${g.max}`;
  return es ? `Elige ${g.min}–${g.max}` : `Choose ${g.min}–${g.max}`;
}
