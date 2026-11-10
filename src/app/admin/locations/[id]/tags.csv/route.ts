import { requireAdmin } from "@/lib/auth/session";
import { siteUrl } from "@/lib/site";

/** Tag list for encoding: one row per tag with the exact link to write onto the chip. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const [{ data: loc }, { data: tags }, { data: tables }] = await Promise.all([
    db.from("locations").select("name").eq("id", id).maybeSingle(),
    db.from("tags").select("code, status, table_id, last_tap_at").eq("location_id", id),
    db.from("dining_tables").select("id, label, section, sort_order").eq("location_id", id),
  ]);
  if (!loc) return new Response("Not found", { status: 404 });
  const base = (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")) ? process.env.NEXT_PUBLIC_SITE_URL : await siteUrl();
  const t = Object.fromEntries((tables ?? []).map((x) => [x.id, x]));
  const rows = (tags ?? []).sort((a, b) => (t[a.table_id ?? ""]?.sort_order ?? 999) - (t[b.table_id ?? ""]?.sort_order ?? 999))
    .map((g) => [t[g.table_id ?? ""]?.label ?? "", t[g.table_id ?? ""]?.section ?? "", g.code, `${base}/t/${g.code}`, `${base}/t/${g.code}?s=qr`,
      g.status === "assigned" ? "On a table" : g.status === "unassigned" ? "Spare" : "Disabled", g.last_tap_at ? new Date(g.last_tap_at).toLocaleDateString("en-US") : ""]);
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "\uFEFF" + [["Table", "Section", "Tag code", "NFC link (write to chip)", "QR link", "Status", "Last tap"], ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const slug = loc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="taptab-tags-${slug}.csv"`, "Cache-Control": "no-store" } });
}
