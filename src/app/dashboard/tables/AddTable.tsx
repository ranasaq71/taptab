"use client";
import { useActionState } from "react";
import { addTable, moveTag } from "./actions";

export function AddTable() {
  const [state, action, pending] = useActionState(addTable, {});
  return (
    <form action={action} className="form inline-form">
      <label className="field"><span>Table name or number</span><input name="label" required placeholder="17 or Patio 3" /></label>
      <label className="field"><span>Section (optional)</span><input name="section" placeholder="A" /></label>
      <button className="btn" disabled={pending}>Add table</button>
      {state.error && <p className="error">{state.error}</p>}
      {state.message && <p className="notice">{state.message}</p>}
    </form>
  );
}

export function AssignSpare({ code, tables }: { code: string; tables: { id: string; label: string; hasTag: boolean }[] }) {
  const [state, action] = useActionState(moveTag, {});
  return (
    <form action={action} className="spare">
      <code>{code}</code>
      <input type="hidden" name="code" value={code} />
      <select name="tableId" defaultValue="" aria-label={`Put tag ${code} on`}>
        <option value="" disabled>Put on table…</option>
        {tables.map((t) => <option key={t.id} value={t.id}>Table {t.label}{t.hasTag ? " (swap)" : ""}</option>)}
      </select>
      <button className="btn-sm">Assign</button>
      {state.error && <span className="error">{state.error}</span>}
    </form>
  );
}
