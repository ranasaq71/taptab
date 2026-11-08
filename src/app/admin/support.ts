"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin, SUPPORT_COOKIE } from "@/lib/auth/session";

/** Opens a restaurant's dashboard as TapTab admin (support mode). */
export async function openSupport(locationId: string) {
  const { db } = await requireAdmin();
  const { data } = await db.from("locations").select("id").eq("id", locationId).maybeSingle();
  if (!data) return;
  (await cookies()).set(SUPPORT_COOKIE, data.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function exitSupport() {
  (await cookies()).delete(SUPPORT_COOKIE);
  redirect("/admin");
}
