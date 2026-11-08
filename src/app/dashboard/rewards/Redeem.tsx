"use client";
import { useState, useTransition } from "react";
import { redeemReward } from "./actions";

export default function Redeem({ id, available, last4 }: { id: string; available: number; last4: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  if (available <= 0) return <span className="muted small">Not yet</span>;
  return (
    <span className="redeem">
      <button className="btn-sm on" disabled={pending} onClick={() => { if (confirm(`Use 1 reward for the guest ending ${last4}?`)) start(async () => setMsg(await redeemReward(id))); }}>
        {pending ? "…" : `Use reward${available > 1 ? ` (${available})` : ""}`}
      </button>
      {msg.error && <span className="error small">{msg.error}</span>}
    </span>
  );
}
