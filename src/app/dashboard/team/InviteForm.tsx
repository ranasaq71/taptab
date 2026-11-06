"use client";
import { useActionState } from "react";
import { inviteMember } from "./actions";

export default function InviteForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(inviteMember, {});
  return (
    <form action={action} className="form inline-form">
      <input type="hidden" name="orgId" value={orgId} />
      <label className="field"><span>Name</span><input name="name" autoComplete="off" /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="off" /></label>
      <label className="field"><span>Role</span>
        <select name="role" defaultValue="staff">
          <option value="staff">Staff: sees requests and stats</option>
          <option value="manager">Manager: can edit the hub and menu</option>
          <option value="owner">Owner: full access, billing, team</option>
        </select>
      </label>
      <button className="btn" disabled={pending}>{pending ? "Sending…" : "Send invite"}</button>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.message && <p className="notice">{state.message}</p>}
    </form>
  );
}
