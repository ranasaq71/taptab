import { requireLocation } from "@/lib/auth/session";
import LiveBoard from "./LiveBoard";
import { loadLive } from "./data";

export const metadata = { title: "Live requests · TapTab" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const ctx = await requireLocation("/dashboard/live");
  const { initial, tableInfo, sectionStaff } = await loadLive(ctx);
  return (
    <>
      <h1>Live requests</h1>
      <p className="muted">Put this on a tablet at the host stand. Requests appear the moment a guest taps.</p>
      <LiveBoard locationId={ctx.location.id} initial={initial} tableInfo={tableInfo} sectionStaff={sectionStaff} />
    </>
  );
}
