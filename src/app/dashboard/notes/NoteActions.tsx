"use client";
import { useTransition } from "react";
import { setRead, markAllRead } from "./actions";

export function ReadToggle({ id, read }: { id: string; read: boolean }) {
  const [pending, start] = useTransition();
  return <button className="link-btn" disabled={pending} onClick={() => start(() => setRead(id, !read))}>{read ? "Mark unread" : "Mark as read"}</button>;
}
export function MarkAll({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return <button className="btn-sm" disabled={disabled || pending} onClick={() => start(() => markAllRead())}>Mark all as read</button>;
}
