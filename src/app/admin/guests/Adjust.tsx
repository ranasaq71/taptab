"use client";
import { useTransition } from "react";
import { adjustCard } from "./actions";

export default function Adjust({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const go = (c: "stamp+" | "stamp-" | "reward+" | "reward-", label: string) => () => { if (confirm(`${label}?`)) start(async () => { const r = await adjustCard(id, c); if (r.error) alert(r.error); }); };
  return (
    <span className="row-gap">
      <button className="btn-sm" disabled={pending} onClick={go("stamp+", "Add 1 stamp")}>+ stamp</button>
      <button className="btn-sm" disabled={pending} onClick={go("stamp-", "Remove 1 stamp")}>− stamp</button>
      <button className="btn-sm" disabled={pending} onClick={go("reward+", "Mark 1 reward used")}>Use reward</button>
      <button className="btn-sm" disabled={pending} onClick={go("reward-", "Undo 1 used reward")}>Undo reward</button>
    </span>
  );
}
