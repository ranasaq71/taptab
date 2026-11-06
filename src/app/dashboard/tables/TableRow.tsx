"use client";
import { useActionState } from "react";
import { updateTable, moveTag, deleteTable } from "./actions";

type T = { id: string; label: string; section: string | null; code: string | null; lastTap: string | null };

export default function TableRow({ t, others }: { t: T; others: { id: string; label: string }[] }) {
  const [saveState, save, saving] = useActionState(updateTable, {});
  const [moveState, move] = useActionState(moveTag, {});
  const [delState, del] = useActionState(deleteTable, {});
  const msg = saveState.error || moveState.error || delState.error;
  const ok = moveState.message || delState.message;
  return (
    <div className="trow2">
      <form action={save} className="trow2-edit">
        <input type="hidden" name="id" value={t.id} />
        <input name="label" defaultValue={t.label} aria-label="Table name" />
        <input name="section" defaultValue={t.section ?? ""} placeholder="Section" aria-label="Section" className="sec" />
        <button className="btn-sm" disabled={saving}>Save</button>
      </form>
      <div className="trow2-tag">
        {t.code ? <><code>{t.code}</code><span className="muted small">{t.lastTap ? `Last tap ${new Date(t.lastTap).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Never tapped"}</span></> : <span className="muted small">No tag</span>}
      </div>
      {t.code && (
        <form action={move} className="trow2-move">
          <input type="hidden" name="code" value={t.code} />
          <select name="tableId" aria-label="Move tag to" defaultValue="">
            <option value="" disabled>Move tag to…</option>
            {others.map((o) => <option key={o.id} value={o.id}>Table {o.label}</option>)}
          </select>
          <button className="btn-sm">Move</button>
        </form>
      )}
      <form action={del} onSubmit={(e) => { if (!confirm(`Remove table ${t.label}?${t.code ? " Its tag will become a spare." : ""}`)) e.preventDefault(); }}>
        <input type="hidden" name="id" value={t.id} />
        <button className="link-btn danger">Remove</button>
      </form>
      {(msg || ok) && <p className={msg ? "error trow2-msg" : "notice trow2-msg"}>{msg || ok}</p>}
    </div>
  );
}
