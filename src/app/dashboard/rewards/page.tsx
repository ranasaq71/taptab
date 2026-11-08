import { requireLocation } from "@/lib/auth/session";
import { toE164 } from "@/lib/sms";
import Redeem from "./Redeem";

export const metadata = { title: "Rewards · TapTab" };
export const dynamic = "force-dynamic";

const mask = (e164: string) => `(•••) •••-${e164.slice(-4)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : "-");

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ phone?: string; sort?: string }> }) {
  const { db, location } = await requireLocation("/dashboard/rewards", { edit: true });
  const sp = await searchParams;
  const lookup = sp.phone ? toE164(sp.phone) : null;
  const { data: hub } = await db.from("hub_settings").select("loyalty_goal, loyalty_reward").eq("location_id", location.id).single();
  const goal = hub?.loyalty_goal ?? 8;

  let q = db.from("loyalty_cards").select("id, phone_e164, stamps, rewards_used, opted_in_at, last_stamp_at").eq("location_id", location.id);
  if (lookup) q = q.eq("phone_e164", lookup);
  const { data: cards } = await q.order(sp.sort === "stamps" ? "stamps" : "last_stamp_at", { ascending: false, nullsFirst: false }).limit(300);
  const { data: all } = await db.from("loyalty_cards").select("stamps, rewards_used, last_stamp_at").eq("location_id", location.id);

  const weekAgo = Date.now() - 7 * 864e5;
  const totals = (all ?? []).reduce((t, c) => {
    const earned = Math.floor(c.stamps / goal);
    t.earned += earned; t.used += c.rewards_used; t.ready += Math.max(0, earned - c.rewards_used);
    if (c.last_stamp_at && new Date(c.last_stamp_at).getTime() > weekAgo) t.active++;
    return t;
  }, { earned: 0, used: 0, ready: 0, active: 0 });

  return (
    <>
      <h1>Rewards</h1>
      <p className="muted">Guests collect one stamp per visit. {goal} stamps = {hub?.loyalty_reward ?? "a reward"}. Change this on the Hub page.</p>
      <div className="stats">
        <div><b>{all?.length ?? 0}</b><span>Members</span></div>
        <div><b>{totals.active}</b><span>Visited this week</span></div>
        <div><b>{totals.ready}</b><span>Rewards ready to use</span></div>
        <div><b>{totals.used}</b><span>Rewards used</span></div>
      </div>

      <section className="card">
        <h2>Find a guest at the register</h2>
        <form className="row-gap" action="/dashboard/rewards">
          <input name="phone" inputMode="tel" placeholder="Guest’s mobile number" defaultValue={sp.phone ?? ""} aria-label="Guest’s mobile number" />
          <button className="btn">Look up</button>
          {sp.phone && <a href="/dashboard/rewards" className="link-btn">Clear</a>}
        </form>
        {sp.phone && !lookup && <p className="error">Enter a 10-digit number.</p>}
        {lookup && !cards?.length && <p className="muted">No rewards card for that number yet. They can start one by tapping “Rewards card” at their table.</p>}
      </section>

      <section className="card">
        <div className="cat-head">
          <h2>{lookup ? "Result" : "Members"}</h2>
          {!lookup && (
            <div className="seg">
              <a href="/dashboard/rewards" aria-current={sp.sort !== "stamps" ? "page" : undefined}>Recent visits</a>
              <a href="/dashboard/rewards?sort=stamps" aria-current={sp.sort === "stamps" ? "page" : undefined}>Most stamps</a>
            </div>
          )}
        </div>
        {cards?.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Guest</th><th>Progress</th><th>Total stamps</th><th>Last visit</th><th>Member since</th><th>Reward</th></tr></thead>
              <tbody>
                {cards.map((c) => {
                  const earned = Math.floor(c.stamps / goal), available = earned - c.rewards_used, progress = c.stamps % goal;
                  return (
                    <tr key={c.id}>
                      <td><b>{lookup ? c.phone_e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : mask(c.phone_e164)}</b></td>
                      <td><span className="progress" aria-label={`${progress} of ${goal}`}><i style={{ width: `${(progress / goal) * 100}%` }} /></span> <span className="muted small">{progress}/{goal}</span></td>
                      <td>{c.stamps}</td>
                      <td>{day(c.last_stamp_at)}</td>
                      <td>{day(c.opted_in_at)}</td>
                      <td><Redeem id={c.id} available={available} last4={c.phone_e164.slice(-4)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !lookup && <p className="live-empty">No members yet. Guests join by tapping “Rewards card” at their table and entering their number.</p>}
      </section>
    </>
  );
}
