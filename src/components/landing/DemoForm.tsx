"use client";
import { useActionState } from "react";
import { submitLead } from "@/app/lead-action";

export default function DemoForm() {
  const [state, action, pending] = useActionState(submitLead, {});
  if (state.ok) {
    return (
      <div className="lp-form-done" role="status">
        <p className="lp-form-done-title">Request received.</p>
        <p>We’ll reach out within one business day to set up a time. Bring a copy of your menu and we’ll have your demo table ready.</p>
      </div>
    );
  }
  return (
    <form action={action} className="lp-form">
      <label><span>Your name</span><input name="name" required autoComplete="name" /></label>
      <label><span>Business name</span><input name="restaurant" required autoComplete="organization" /></label>
      <label><span>Email</span><input name="email" type="email" autoComplete="email" /></label>
      <label><span>Phone</span><input name="phone" inputMode="tel" autoComplete="tel" /></label>
      <label><span>Tables or spots</span><input name="tables" type="number" min={1} max={500} placeholder="e.g. 20, or 1 for a food truck" /></label>
      <label className="wide"><span>Anything we should know? (optional)</span><textarea name="message" rows={3} /></label>
      <label className="lp-hp" aria-hidden>Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
      {state.error && <p className="lp-form-error wide" role="alert">{state.error}</p>}
      <button className="lp-btn gold wide" disabled={pending}>{pending ? "Sending…" : "Book my demo"}</button>
      <p className="lp-form-note wide">Email or phone is enough. We only use it to schedule your demo.</p>
    </form>
  );
}
