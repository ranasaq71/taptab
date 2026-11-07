import "server-only";
import type { LocationCtx } from "@/lib/auth/session";

export type Req = { id: string; tableId: string | null; kind: "help" | "check" | "refill"; status: "open" | "done"; createdAt: string; resolvedAt: string | null };
export type TableInfo = Record<string, { label: string; section: string | null }>;

/** Everything the live board needs: today's requests, table names and who covers each section. */
export async function loadLive(ctx: LocationCtx) {
  const since = new Date(); since.setHours(since.getHours() - 16); // covers a full service day
  const [{ data: reqs }, { data: tables }, { data: staff }] = await Promise.all([
    ctx.db.from("service_requests").select("id, table_id, kind, status, created_at, resolved_at")
      .eq("location_id", ctx.location.id).or(`status.eq.open,created_at.gte.${since.toISOString()}`)
      .order("created_at", { ascending: false }).limit(200),
    ctx.db.from("dining_tables").select("id, label, section").eq("location_id", ctx.location.id),
    ctx.db.from("staff_contacts").select("name, sections, alerts_on").eq("location_id", ctx.location.id),
  ]);
  const tableInfo: TableInfo = Object.fromEntries((tables ?? []).map((t) => [t.id, { label: t.label, section: t.section }]));
  const sectionStaff: Record<string, string[]> = {};
  for (const s of staff ?? []) for (const sec of (s.sections?.length ? s.sections : ["*"])) (sectionStaff[sec.toUpperCase()] ??= []).push(s.name);
  const initial: Req[] = (reqs ?? []).map((r) => ({ id: r.id, tableId: r.table_id, kind: r.kind, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at }));
  return { initial, tableInfo, sectionStaff };
}
