"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Landing page for invite links. Supabase's default invite email puts the session
 * after the # in the URL, which only the browser can read. We store it, then send
 * the new team member to choose their password.
 */
export default function AcceptInvite() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) { setFailed(true); return; }
    supabaseBrowser().auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setFailed(true);
      else window.location.replace(hash.get("type") === "invite" || hash.get("type") === "recovery" ? "/reset-password" : "/app");
    });
  }, []);
  return (
    <main className="auth">
      <span className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</span>
      {failed ? (
        <>
          <h1>This link has expired</h1>
          <p className="muted">Invite links work once and expire after a day. Ask the restaurant owner to send a new invite, or <a href="/forgot-password">reset your password</a> if you already have an account.</p>
        </>
      ) : <h1>Signing you in…</h1>}
    </main>
  );
}
