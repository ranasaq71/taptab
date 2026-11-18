import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireLocation } from "@/lib/auth/session";
import { exchangeCode, emailFromIdToken, listLocations, GoogleError } from "@/lib/google";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
const STATE_COOKIE = "taptab_g_state";

export async function GET(req: NextRequest) {
  const site = await siteUrl();
  const back = (q: string) => NextResponse.redirect(`${site}/dashboard/reviews?${q}`);
  const jar = await cookies();
  const [nonce, locId] = (jar.get(STATE_COOKIE)?.value ?? "").split(".");
  jar.delete({ name: STATE_COOKIE, path: "/api/google" });
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back("g=cancelled");
  if (!nonce || p.get("state") !== nonce || !p.get("code")) return back("g=expired");

  const { location, user } = await requireLocation("/dashboard/reviews", { edit: true });
  if (location.id !== locId) return back("g=expired");
  try {
    const t = await exchangeCode(p.get("code")!, `${site}/api/google/callback`);
    if (!t.refresh_token) return back("g=no-refresh");
    // If the Google account manages exactly one business, pick it; otherwise the owner chooses on the page.
    let pick: { account: string; name: string; title: string } | null = null;
    try { const all = await listLocations(t.access_token); if (all.length === 1) pick = all[0]; } catch { /* listing can fail before Google approves the project; choose later */ }
    const { error } = await supabaseAdmin().from("google_connections").upsert({
      location_id: location.id, google_email: emailFromIdToken(t.id_token), refresh_token: t.refresh_token,
      account_name: pick?.account ?? null, location_name: pick?.name ?? null, location_title: pick?.title ?? null,
      connected_by: user.id, connected_at: new Date().toISOString(), last_error: null,
    });
    if (error) throw new Error(error.message);
    return back("g=connected");
  } catch (e) {
    console.error("[google] callback", e);
    return back(`g=error&msg=${encodeURIComponent(e instanceof GoogleError ? e.message : "Couldn’t connect to Google.")}`);
  }
}
