import { requireLocation } from "@/lib/auth/session";

/** Owners and managers download their rewards members as a spreadsheet (CSV). */
export async function GET() {
  const ctx = await requireLocation("/dashboard/rewards", { edit: true });
  const [{ data: hub }, { data: cards }] = await Promise.all([
    ctx.db.from("hub_settings").select("loyalty_goal").eq("location_id", ctx.location.id).single(),
    ctx.db.from("loyalty_cards").select("phone_e164, stamps, rewards_used, opted_in_at, last_stamp_at").eq("location_id", ctx.location.id).order("last_stamp_at", { ascending: false, nullsFirst: false }),
  ]);
  const goal = hub?.loyalty_goal ?? 8;
  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago" }) : "");
  const cell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = ["Mobile", "Total stamps", "Stamps toward next reward", "Rewards earned", "Rewards used", "Rewards available", "Member since", "Last visit", "Consent"];
  const rows = (cards ?? []).map((c) => {
    const earned = Math.floor(c.stamps / goal);
    return [c.phone_e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3"), c.stamps, `${c.stamps % goal}/${goal}`, earned, c.rewards_used, earned - c.rewards_used, d(c.opted_in_at), d(c.last_stamp_at), "Rewards card only (no marketing texts)"];
  });
  const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const slug = ctx.location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="taptab-members-${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
