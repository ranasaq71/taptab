"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";

/** Admin fixes for a guest's rewards card: add/remove a stamp, use/undo a reward. */
export async function adjustCard(cardId: string, change: "stamp+" | "stamp-" | "reward+" | "reward-"): Promise<{ error?: string }> {
  const { db } = await requireAdmin();
  const { data: c } = await db.from("loyalty_cards").select("id, stamps, rewards_used").eq("id", cardId).maybeSingle();
  if (!c) return { error: "Card not found." };
  const next = { stamps: c.stamps, rewards_used: c.rewards_used };
  if (change === "stamp+") next.stamps += 1;
  if (change === "stamp-") next.stamps = Math.max(0, c.stamps - 1);
  if (change === "reward+") next.rewards_used += 1;
  if (change === "reward-") next.rewards_used = Math.max(0, c.rewards_used - 1);
  const { error } = await db.from("loyalty_cards").update(next).eq("id", c.id).eq("stamps", c.stamps).eq("rewards_used", c.rewards_used);
  if (error) return { error: "Couldn’t update." };
  revalidatePath("/admin/guests");
  return {};
}
