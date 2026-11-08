import type { Analytics } from "./compute";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Bars({ data, tall = 140, every = 1, title }: { data: { label: string; value: number }[]; tall?: number; every?: number; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} style={{ height: tall + 28 }}>
      {data.map((d, i) => (
        <div key={i} className="bar-col" title={`${d.label}: ${d.value}`}>
          <span className="bar-val">{d.value || ""}</span>
          <span className="bar" style={{ height: `${(d.value / max) * tall}px` }} />
          <span className="bar-lbl">{i % every === 0 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

function HBars({ data, total, unit = "" }: { data: { label: string; value: number }[]; total?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d) => (
        <div key={d.label} className="hbar">
          <span className="hbar-lbl">{d.label}</span>
          <span className="hbar-track"><i style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="hbar-val">{d.value}{unit}{total ? <small> · {pct(d.value, total)}%</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsView({ a }: { a: Analytics }) {
  const change = a.prevTaps ? Math.round(((a.taps - a.prevTaps) / a.prevTaps) * 100) : null;
  const google = a.funnel[2].value, reviewOpens = a.funnel[1].value;
  const empty = a.taps === 0;
  return (
    <>
      <div className="stats">
        <div><b>{a.taps.toLocaleString()}</b><span>Guest taps{change != null ? <em className={change >= 0 ? "up" : "down"}> {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</em> : null}</span></div>
        <div><b>{google}</b><span>Sent to Google reviews</span></div>
        <div><b>{a.requests.avgMin != null ? `${a.requests.avgMin < 1 ? "<1" : Math.round(a.requests.avgMin)} min` : "-"}</b><span>Avg response to requests</span></div>
        <div><b>{a.rewards.newMembers}</b><span>New rewards members</span></div>
      </div>

      {empty && <p className="live-empty" style={{ marginTop: 20 }}>No guest taps in this period yet. Charts fill in as guests tap their table tags.</p>}

      <div className="an-grid">
        <section className="card an-wide">
          <h2>Taps per day</h2>
          <Bars data={a.byDay} every={a.rangeDays > 14 ? 5 : 1} title="Taps per day" />
        </section>

        <section className="card an-wide">
          <h2>Busiest hours</h2>
          <p className="muted small">When guests tap, in restaurant time. Useful for staffing.</p>
          <Bars data={a.byHour} tall={110} every={3} title="Taps by hour" />
        </section>

        <section className="card">
          <h2>What guests open</h2>
          <HBars data={a.opens.filter((o) => o.value > 0 || ["menu", "review", "server"].includes(o.key))} total={a.taps} />
        </section>

        <section className="card">
          <h2>Review funnel</h2>
          <p className="muted small">Every guest sees the Google link; unhappy guests can also message you privately.</p>
          <div className="funnel">
            {a.funnel.map((f, i) => (
              <div key={f.label} className="funnel-step" style={{ width: `${Math.max(28, 100 - i * 24)}%` }}>
                <b>{f.value}</b><span>{f.label}</span>
              </div>
            ))}
          </div>
          <p className="small">{reviewOpens ? <><b>{pct(google, reviewOpens)}%</b> of guests who opened the review screen went on to Google.</> : "No review activity yet."} {a.notes ? <>{a.notes} private note{a.notes > 1 ? "s" : ""}{a.lowNotes ? ` (${a.lowNotes} at 3 stars or less)` : ""}.</> : null}</p>
        </section>

        <section className="card">
          <h2>Server requests</h2>
          <div className="mini-stats">
            <div><b>{a.requests.total}</b><span>Requests</span></div>
            <div><b>{a.requests.under3Pct != null ? `${a.requests.under3Pct}%` : "-"}</b><span>Answered in 3 min</span></div>
            <div><b>{a.requests.busiestHour ?? "-"}</b><span>Busiest hour</span></div>
          </div>
          <HBars data={a.requests.byKind} total={a.requests.total} />
        </section>

        <section className="card">
          <h2>Busiest tables</h2>
          {a.tables.length ? <HBars data={a.tables.map((t) => ({ label: `Table ${t.label}`, value: t.value }))} /> : <p className="muted small">No table taps yet.</p>}
          <div className="split">
            <span><b>{pct(a.nfc, a.taps)}%</b> tapped the NFC tag</span>
            <span><b>{pct(a.qr, a.taps)}%</b> scanned the QR code</span>
          </div>
          <span className="split-bar"><i style={{ width: `${pct(a.nfc, a.taps)}%` }} /></span>
        </section>

        <section className="card">
          <h2>Rewards</h2>
          <div className="mini-stats">
            <div><b>{a.rewards.newMembers}</b><span>New members</span></div>
            <div><b>{a.rewards.returning}</b><span>Returning members</span></div>
          </div>
          <p className="muted small">Returning = joined before this period and collected a stamp during it.</p>
        </section>
      </div>
    </>
  );
}
