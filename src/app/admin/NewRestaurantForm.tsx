"use client";
import { useActionState } from "react";
import { createRestaurant } from "./actions";

export default function NewRestaurantForm() {
  const [state, action, pending] = useActionState(createRestaurant, {});
  return (
    <form action={action} className="form inline-form">
      <label className="field"><span>Restaurant name</span><input name="name" required /></label>
      <label className="field"><span>Number of tables</span><input name="tables" type="number" min={1} max={150} defaultValue={20} required /></label>
      <label className="field"><span>Owner name (optional)</span><input name="ownerName" /></label>
      <label className="field"><span>Owner email (optional, sends invite)</span><input name="ownerEmail" type="email" /></label>
      <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create restaurant"}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
    </form>
  );
}
