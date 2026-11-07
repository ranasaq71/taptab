"use client";
import { useState, useTransition } from "react";
import { saveStaff, deleteStaff, testText, type R } from "./actions";

export type StaffRow = { id: string; name: string; phone: string; sections: string[]; alerts: boolean };
const pretty = (e164: string) => e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<R>({});
  return { pending, msg, run: (fn: () => Promise<R>, after?: (r: R) => void) => start(async () => { const r = await fn(); setMsg(r); after?.(r); }) };
}
const Msg = ({ m }: { m: R }) => (m.error ? <p className="error">{m.error}</p> : m.message ? <p className="notice">{m.message}</p> : null);

export default function StaffEditor({ staff, knownSections, smsOn }: { staff: StaffRow[]; knownSections: string[]; smsOn: boolean }) {
  return (
    <>
      <section className="card">
        <h2>Who gets alerts</h2>
        <p className="muted small">
          When a guest taps “Call server”, everyone covering that table’s section gets a text{smsOn ? "" : " (once text alerts are switched on)"}. Leave sections empty for someone who covers every table, like a manager.
          {knownSections.length ? <> Your sections: <b>{knownSections.join(", ")}</b> (set them on the Tables page).</> : <> You haven’t set table sections yet; do that on the Tables page.</>}
        </p>
        {staff.length ? staff.map((s) => <StaffItem key={s.id} s={s} />) : <p className="muted">No staff added yet.</p>}
      </section>
      <section className="card">
        <h2>Add a staff member</h2>
        <StaffForm />
      </section>
    </>
  );
}

function StaffItem({ s }: { s: StaffRow }) {
  const [editing, setEditing] = useState(false);
  const a = useAct();
  if (editing) return <StaffForm s={s} onDone={() => setEditing(false)} />;
  return (
    <div className="staff-row">
      <div><b>{s.name}</b> <span className="muted small">{pretty(s.phone)}</span></div>
      <div className="muted small">{s.sections.length ? `Sections ${s.sections.join(", ")}` : "All tables"}{s.alerts ? "" : " · alerts paused"}</div>
      <div className="row-gap">
        <button className="link-btn" disabled={a.pending} onClick={() => a.run(() => testText(s.id))}>Send test text</button>
        <button className="link-btn" onClick={() => setEditing(true)}>Edit</button>
        <button className="link-btn danger" onClick={() => { if (confirm(`Remove ${s.name}?`)) a.run(() => deleteStaff(s.id)); }}>Remove</button>
      </div>
      <Msg m={a.msg} />
    </div>
  );
}

function StaffForm({ s, onDone }: { s?: StaffRow; onDone?: () => void }) {
  const a = useAct();
  return (
    <form className="form inline-form" onSubmit={(e) => {
      e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
      a.run(() => saveStaff({ id: s?.id, name: String(f.get("name")), phone: String(f.get("phone")), sections: String(f.get("sections")), alerts: f.get("alerts") === "on" }),
        (r) => { if (r.ok) { if (s) onDone?.(); else form.reset(); } });
    }}>
      <label className="field"><span>Name</span><input name="name" defaultValue={s?.name} required placeholder="Maria" /></label>
      <label className="field"><span>Mobile</span><input name="phone" defaultValue={s ? pretty(s.phone) : ""} inputMode="tel" required placeholder="(281) 555-0101" /></label>
      <label className="field"><span>Sections (comma-separated, empty = all)</span><input name="sections" defaultValue={s?.sections.join(", ")} placeholder="A, B" /></label>
      <label className="check-row"><input type="checkbox" name="alerts" defaultChecked={s?.alerts ?? true} /> Send alerts</label>
      <div className="row-gap">
        <button className="btn" disabled={a.pending}>{s ? "Save" : "Add"}</button>
        {s && <button type="button" className="link-btn" onClick={onDone}>Cancel</button>}
      </div>
      <Msg m={a.msg} />
    </form>
  );
}
