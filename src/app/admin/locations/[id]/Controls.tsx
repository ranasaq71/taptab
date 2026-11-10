"use client";
import { useState, useTransition } from "react";
import * as A from "./actions";

type R = { ok?: true; error?: string; message?: string };
function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<R>({});
  return { pending, msg, run: (fn: () => Promise<R>) => start(async () => setMsg(await fn())) };
}
const Msg = ({ m }: { m: R }) => (m.error ? <p className="error small">{m.error}</p> : m.message ? <p className="notice small">{m.message}</p> : null);

export function AccountForm({ locationId, orgId, plan, status }: { locationId: string; orgId: string; plan: string; status: string }) {
  const a = useAct();
  return (
    <form className="row-gap" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); a.run(() => A.updateAccount(locationId, orgId, String(f.get("plan")), String(f.get("status")))); }}>
      <label className="field inline"><span>Plan</span>
        <select name="plan" defaultValue={plan}><option value="essential">Essential · $39/mo</option><option value="pro">Pro · $59/mo</option><option value="business">Business · $99/mo</option></select>
      </label>
      <label className="field inline"><span>Status</span>
        <select name="status" defaultValue={status}><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select>
      </label>
      <button className="btn-sm" disabled={a.pending}>Save</button>
      <Msg m={a.msg} />
    </form>
  );
}

const STEPS = ["ordered", "encoded", "shipped", "installed"] as const;
const STEP_LABEL: Record<string, string> = { ordered: "Ordered", encoded: "Encoded", shipped: "Shipped", installed: "Installed" };
const TYPE_LABEL: Record<string, string> = { standard: "Standard TapTab stands", custom: "Custom branded stands", sticker: "Stickers" };

export function OrderRow({ locationId, o }: { locationId: string; o: { id: string; stand_type: string; quantity: number; status: string; notes: string | null; created_at: string; updated_at: string } }) {
  const a = useAct();
  const i = STEPS.indexOf(o.status as any), next = STEPS[i + 1];
  return (
    <div className="order">
      <div className="order-main">
        <b>{o.quantity} × {TYPE_LABEL[o.stand_type] ?? o.stand_type}</b>
        <span className="muted small">Ordered {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{o.notes ? ` · ${o.notes}` : ""}</span>
      </div>
      <ol className="steps">{STEPS.map((s, k) => <li key={s} className={k <= i ? "on" : ""}>{STEP_LABEL[s]}</li>)}</ol>
      <div className="row-gap">
        {next && <button className="btn-sm on" disabled={a.pending} onClick={() => a.run(() => A.setOrderStatus(locationId, o.id, next))}>Mark {STEP_LABEL[next].toLowerCase()}</button>}
        {i > 0 && <button className="link-btn" disabled={a.pending} onClick={() => a.run(() => A.setOrderStatus(locationId, o.id, STEPS[i - 1]))}>Undo</button>}
        <button className="link-btn danger" onClick={() => { if (confirm("Delete this order?")) a.run(() => A.deleteOrder(locationId, o.id)); }}>Delete</button>
      </div>
      <Msg m={a.msg} />
    </div>
  );
}

export function AddOrder({ locationId, tables }: { locationId: string; tables: number }) {
  const a = useAct();
  return (
    <form className="form inline-form" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); a.run(async () => { const r = await A.addOrder(locationId, { standType: String(f.get("type")), quantity: Number(f.get("qty")), notes: String(f.get("notes")) }); if (r.ok) form.reset(); return r; }); }}>
      <label className="field"><span>Type</span><select name="type" defaultValue="standard"><option value="standard">Standard TapTab stands</option><option value="custom">Custom branded stands</option><option value="sticker">Stickers</option></select></label>
      <label className="field"><span>Quantity</span><input name="qty" type="number" min={1} max={500} defaultValue={tables + 3} /></label>
      <label className="field"><span>Notes (supplier, tracking…)</span><input name="notes" /></label>
      <button className="btn" disabled={a.pending}>Add order</button>
      <Msg m={a.msg} />
    </form>
  );
}

export function SpareTags({ locationId }: { locationId: string }) {
  const a = useAct();
  return (
    <form className="row-gap" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); a.run(() => A.addSpareTags(locationId, Number(f.get("n")))); }}>
      <input name="n" type="number" min={1} max={50} defaultValue={3} aria-label="How many spare tags" className="num" />
      <button className="btn-sm" disabled={a.pending}>Add spare tags</button>
      <Msg m={a.msg} />
    </form>
  );
}

export function TagToggle({ locationId, code, disabled }: { locationId: string; code: string; disabled: boolean }) {
  const a = useAct();
  return (
    <span>
      <button className={`link-btn${disabled ? "" : " danger"}`} disabled={a.pending}
        onClick={() => { if (disabled || confirm(`Disable tag ${code}? It stops working immediately (use this for lost or stolen stands).`)) a.run(() => A.setTagEnabled(locationId, code, disabled)); }}>
        {disabled ? "Turn back on (as spare)" : "Disable"}
      </button>
      {a.msg.error && <span className="error small"> {a.msg.error}</span>}
    </span>
  );
}
