"use client";
import { useActionState } from "react";
import type { FormState } from "./actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

export default function AuthForm({ action, fields, submit, hidden }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Field[]; submit: string; hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.message) return <p className="notice">{state.message}</p>;
  return (
    <form action={formAction} className="form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          <input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
        </label>
      ))}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Please wait…" : submit}</button>
    </form>
  );
}
