import { requireLocation } from "@/lib/auth/session";
import MenuEditor, { type MCat } from "./MenuEditor";

export const metadata = { title: "Menu · TapTab" };
export const maxDuration = 120; // AI reading a long menu can take up to a minute

export default async function MenuPage() {
  const { db, location } = await requireLocation("/dashboard/menu", { edit: true });
  const { data: menu } = await db.from("menus")
    .select("id, pdf_url, menu_categories(id, name, sort_order, menu_items(id, name, description, price_cents, tags, photo_url, available, sort_order))")
    .eq("location_id", location.id).eq("active", true).order("created_at").limit(1).maybeSingle();
  const bySort = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;
  const cats: MCat[] = ((menu?.menu_categories as any[]) ?? []).sort(bySort).map((c) => ({
    id: c.id, name: c.name ?? {},
    items: (c.menu_items ?? []).sort(bySort).map((i: any) => ({
      id: i.id, name: i.name ?? {}, description: i.description ?? {}, priceCents: i.price_cents, tags: i.tags ?? [], photoUrl: i.photo_url, available: i.available,
    })),
  }));
  const dishes = cats.reduce((n, c) => n + c.items.length, 0);
  return (
    <>
      <h1>Menu</h1>
      <p className="muted">{dishes} dishes in {cats.length} sections. Changes show on every table as soon as you save.</p>
      <MenuEditor cats={cats} pdfUrl={menu?.pdf_url ?? null} />
    </>
  );
}
