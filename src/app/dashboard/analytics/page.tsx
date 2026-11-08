import Link from "next/link";
import { requireLocation } from "@/lib/auth/session";
import { compute } from "./compute";
import AnalyticsView from "./AnalyticsView";

export const metadata = { title: "Analytics · TapTab" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireLocation("/dashboard/analytics", { edit: true });
  const days = (await searchParams).range === "30" ? 30 : 7;
  const since = new Date(Date.now() - days * 864e5), prevSince = new Date(Date.now() - 2 * days * 864e5);
  const loc = ctx.location.id;
  const [{ data: events }, { count: prevTaps }, { data: requests }, { data: cards }, { data: notes }, { data: tables }, { data: tz }] = await Promise.all([
    ctx.db.from("events").select("type, created_at, source, table_id").eq("location_id", loc).gte("created_at", since.toISOString()).limit(100000),
    ctx.db.from("events").select("id", { count: "exact", head: true }).eq("location_id", loc).eq("type", "tap").gte("created_at", prevSince.toISOString()).lt("created_at", since.toISOString()),
    ctx.db.from("service_requests").select("kind, status, created_at, resolved_at").eq("location_id", loc).gte("created_at", since.toISOString()).limit(50000),
    ctx.db.from("loyalty_cards").select("opted_in_at, last_stamp_at").eq("location_id", loc),
    ctx.db.from("guest_notes").select("stars, created_at").eq("location_id", loc).gte("created_at", since.toISOString()),
    ctx.db.from("dining_tables").select("id, label").eq("location_id", loc),
    ctx.db.from("locations").select("timezone").eq("id", loc).single(),
  ]);
  const a = compute({
    days, tz: tz?.timezone ?? "America/Chicago", since, prevTaps: prevTaps ?? 0,
    events: events ?? [], requests: requests ?? [], cards: cards ?? [], notes: notes ?? [],
    tableLabels: Object.fromEntries((tables ?? []).map((t) => [t.id, t.label])),
  });
  return (
    <>
      <div className="cat-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted">{ctx.location.name} · last {days} days, compared with the {days} days before.</p>
        </div>
        <div className="seg">
          <Link href="/dashboard/analytics" aria-current={days === 7 ? "page" : undefined}>7 days</Link>
          <Link href="/dashboard/analytics?range=30" aria-current={days === 30 ? "page" : undefined}>30 days</Link>
        </div>
      </div>
      <AnalyticsView a={a} />
    </>
  );
}
