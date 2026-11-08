import { requireAdmin } from "@/lib/auth/session";
import { toE164 } from "@/lib/sms";
import Adjust from "./Adjust";

export const metadata = { title: "Guests · TapTab admin" };
export const dynamic = "force-dynamic";

const fmt = (e164: string) => e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const mask = (e164: string) => `(•••) •••-${e164.slice(-4)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "-");

export default async function Guests({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { db } = await requireAdmin();
  const raw = (await searchParams).phone ?? "";
  const phone = raw ? toE164(raw) : null;
  let q = db.from("loyalty_cards").select("id, phone_e164, stamps, rewards_used, opted_in_at, last_stamp_at, locations(name, hub_settings(loyalty_goal))").order("last_stamp_at", { ascending: false, nullsFirst: false }).limit(phone ? 50 : 100);
  if (phone) q = q.eq("phone_e164", phone);
  const [{ data: cards }, { count: total }] = await Promise.all([q, db.from("loyalty_cards").select("id", { count: "exact", head: true })]);

  return (
    <>
      <h1>Guests</h1>
      <p className="muted">Rewards members across every restaurant ({total ?? 0} cards). Search a phone number to see that guest’s cards everywhere and fix glitches.</p>
      <section className="card">
        <form className="row-gap" action="/admin/guests">
          <input name="phone" inputMode="tel" placeholder="Guest’s mobile number" defaultValue={raw} aria-label="Guest’s mobile number" />
          <button className="btn">Search</button>
          {raw && <a href="/admin/guests" className="link-btn">Clear</a>}
        </form>
        {raw && !phone && <p className="error">Enter a 10-digit number.</p>}
      </section>
      <section className="card">
        <h2>{phone ? `Cards for ${fmt(phone)}` : "Most recent activity"}</h2>
        {cards?.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Guest</th><th>Restaurant</th><th>Stamps</th><th>Rewards earned / used</th><th>Last visit</th><th>Member since</th>{phone && <th>Fix</th>}</tr></thead>
              <tbody>
                {cards.map((c: any) => {
                  const loc = Array.isArray(c.locations) ? c.locations[0] : c.locations;
                  const hub = Array.isArray(loc?.hub_settings) ? loc.hub_settings[0] : loc?.hub_settings;
                  const goal = hub?.loyalty_goal ?? 8, earned = Math.floor(c.stamps / goal);
                  return (
                    <tr key={c.id}>
                      <td><b>{phone ? fmt(c.phone_e164) : mask(c.phone_e164)}</b></td>
                      <td>{loc?.name ?? "?"}</td>
                      <td>{c.stamps} <span className="muted small">({c.stamps % goal}/{goal})</span></td>
                      <td>{earned} / {c.rewards_used}</td>
                      <td>{day(c.last_stamp_at)}</td>
                      <td>{day(c.opted_in_at)}</td>
                      {phone && <td><Adjust id={c.id} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="live-empty">{phone ? "No rewards cards for that number." : "No rewards members yet."}</p>}
      </section>
    </>
  );
}
