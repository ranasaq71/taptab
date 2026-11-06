import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const db = await supabaseServer();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin), { status: 303 });
}
