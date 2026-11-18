import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireLocation } from "@/lib/auth/session";
import { authUrl, googleReady } from "@/lib/google";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "taptab_g_state";

/** Start "Connect Google Business Profile" for the restaurant currently open in the dashboard. */
export async function GET() {
  const { location } = await requireLocation("/dashboard/reviews", { edit: true });
  const site = await siteUrl();
  if (!googleReady()) return NextResponse.redirect(`${site}/dashboard/reviews?g=not-ready`);
  const nonce = randomBytes(16).toString("hex");
  (await cookies()).set(STATE_COOKIE, `${nonce}.${location.id}`, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/google" });
  return NextResponse.redirect(authUrl(`${site}/api/google/callback`, nonce));
}
