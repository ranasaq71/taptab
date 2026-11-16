import "server-only";

/**
 * Send an email through Resend (https://resend.com). Needs RESEND_API_KEY in Vercel.
 * Returns false instead of throwing, so a mail problem never breaks the action that called it.
 */
export async function sendEmail(msg: { to: string | string[]; subject: string; html: string; text: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[email] RESEND_API_KEY is not set; skipped:", msg.subject); return false; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "TapTab <hello@brandrise.us>",
        to: msg.to, subject: msg.subject, html: msg.html, text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
