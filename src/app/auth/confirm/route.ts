import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/site";

/** Handles every email link: sign-up confirmation, invites, password resets. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const db = await supabaseServer();

  let ok = false;
  if (tokenHash && type) ok = !(await db.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await db.auth.exchangeCodeForSession(code)).error;

  // Invited users and password resets must choose a password before continuing.
  const dest = ok ? (type === "invite" || type === "recovery" ? "/reset-password" : next) : "/login?error=link";
  return NextResponse.redirect(new URL(dest, url.origin));
}
