import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncLocation } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily (Vercel Cron): pull new Google reviews for every connected restaurant, draft and post replies. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin().from("google_connections").select("location_id").not("location_name", "is", null);
  const results: Record<string, unknown> = {};
  for (const c of data ?? []) results[c.location_id] = await syncLocation(c.location_id);
  return NextResponse.json({ ok: true, results });
}
