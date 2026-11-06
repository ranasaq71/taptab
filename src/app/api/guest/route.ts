import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TAG_CODE } from "@/lib/hub";

const base = { code: z.string().regex(TAG_CODE), sessionId: z.string().max(64).optional() };
const Body = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("event"), type: z.enum(["menu", "wifi", "review", "google", "server", "loyalty", "instagram", "tiktok"]) }),
  z.object({ ...base, action: z.literal("request"), kind: z.enum(["help", "check", "refill"]) }),
  z.object({ ...base, action: z.literal("note"), stars: z.number().int().min(1).max(5).optional(), body: z.string().trim().min(1).max(2000) }),
  z.object({ ...base, action: z.literal("stamp"), phone: z.string().trim().min(7).max(20), consent: z.literal(true) }),
]);

/** US-focused phone normalizer: "(281) 555-0101" -> "+12815550101". */
function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const db = supabaseAdmin();

  const { data: tag } = await db.from("tags").select("code, status, location_id, table_id").eq("code", b.code.toUpperCase()).maybeSingle();
  if (!tag || tag.status !== "assigned") return NextResponse.json({ error: "Unknown tag" }, { status: 404 });
  const where = { location_id: tag.location_id, table_id: tag.table_id };

  // Events record what guests OPEN (the hub logs those when a screen opens).
  // Requests and stamps live in their own tables, so they are not logged twice here.
  switch (b.action) {
    case "event": {
      await db.from("events").insert({ ...where, tag_code: tag.code, type: b.type, session_id: b.sessionId ?? null });
      return NextResponse.json({ ok: true });
    }

    case "request": {
      // If this table already has the same open request, don't create a duplicate alert.
      const { data: existing } = await db.from("service_requests").select("id")
        .eq("table_id", tag.table_id).eq("kind", b.kind).eq("status", "open").limit(1);
      if (existing?.length) return NextResponse.json({ ok: true, duplicate: true });
      const { error } = await db.from("service_requests").insert({ ...where, kind: b.kind });
      if (error) return NextResponse.json({ error: "Could not send" }, { status: 500 });
      // TODO (Day 6): text the staff assigned to this table's section via Twilio.
      return NextResponse.json({ ok: true });
    }

    case "note": {
      // Simple flood guard: at most 3 notes per table per 10 minutes.
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count } = await db.from("guest_notes").select("id", { count: "exact", head: true })
        .eq("table_id", tag.table_id).gte("created_at", since);
      if ((count ?? 0) >= 3) return NextResponse.json({ error: "Please try again in a few minutes" }, { status: 429 });
      await db.from("guest_notes").insert({ ...where, stars: b.stars ?? null, body: b.body });
      return NextResponse.json({ ok: true });
    }

    case "stamp": {
      const phone = toE164(b.phone);
      if (!phone) return NextResponse.json({ error: "Enter a 10-digit phone number" }, { status: 400 });
      const { data: hub } = await db.from("hub_settings").select("loyalty_goal, loyalty_reward").eq("location_id", tag.location_id).single();
      const goal = hub?.loyalty_goal ?? 8;
      const { data: card } = await db.from("loyalty_cards").select("*").eq("location_id", tag.location_id).eq("phone_e164", phone).maybeSingle();

      // One stamp per visit: no second stamp within 12 hours.
      if (card?.last_stamp_at && Date.now() - new Date(card.last_stamp_at).getTime() < 12 * 3600_000) {
        return NextResponse.json({ ok: true, alreadyStamped: true, stamps: card.stamps % goal, goal, reward: false });
      }
      const stamps = (card?.stamps ?? 0) + 1;
      const now = new Date().toISOString();
      if (card) await db.from("loyalty_cards").update({ stamps, last_stamp_at: now }).eq("id", card.id);
      else await db.from("loyalty_cards").insert({ location_id: tag.location_id, phone_e164: phone, stamps, last_stamp_at: now });
      const reward = stamps % goal === 0;
      return NextResponse.json({ ok: true, stamps: reward ? goal : stamps % goal, goal, reward, rewardText: reward ? hub?.loyalty_reward : null });
    }
  }
}
