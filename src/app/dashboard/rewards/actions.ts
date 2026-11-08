"use server";
import { revalidatePath } from "next/cache";
import { requireLocation } from "@/lib/auth/session";

/** Uses one earned reward. Only succeeds if the guest really has one available. */
export async function redeemReward(cardId: string): Promise<{ ok?: true; error?: string; message?: string }> {
  const ctx = await requireLocation("/dashboard/rewards", { edit: true });
  const [{ data: card }, { data: hub }] = await Promise.all([
    ctx.db.from("loyalty_cards").select("id, stamps, rewards_used, phone_e164").eq("id", cardId).eq("location_id", ctx.location.id).maybeSingle(),
    ctx.db.from("hub_settings").select("loyalty_goal").eq("location_id", ctx.location.id).single(),
  ]);
  if (!card) return { error: "Member not found." };
  const goal = hub?.loyalty_goal ?? 8;
  const available = Math.floor(card.stamps / goal) - card.rewards_used;
  if (available <= 0) return { error: "This guest has no reward available yet." };
  // Only update if nobody else redeemed it a moment ago.
  const { data: updated } = await ctx.db.from("loyalty_cards").update({ rewards_used: card.rewards_used + 1 })
    .eq("id", card.id).eq("rewards_used", card.rewards_used).select("id");
  if (!updated?.length) return { error: "That reward was just used. Refresh the page." };
  revalidatePath("/dashboard/rewards");
  return { ok: true, message: `Reward used for the guest ending ${card.phone_e164.slice(-4)}.` };
}
