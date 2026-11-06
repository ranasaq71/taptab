import { requireLocation } from "@/lib/auth/session";
import HubForm from "./HubForm";

export const metadata = { title: "Hub · TapTab" };

export default async function HubPage() {
  const { db, location } = await requireLocation("/dashboard/hub", { edit: true });
  const [{ data: hub }, { data: tag }] = await Promise.all([
    db.from("hub_settings").select("*").eq("location_id", location.id).single(),
    db.from("tags").select("code").eq("location_id", location.id).eq("status", "assigned").limit(1).maybeSingle(),
  ]);
  return (
    <>
      <h1>Your hub</h1>
      <p className="muted">What guests see when they tap. Changes go live on every table as soon as you save.</p>
      <HubForm previewUrl={tag ? `/t/${tag.code}?preview=1` : null} v={{
        name: location.name, tagline: location.tagline ?? "", brand_color: location.brand_color, logo_url: location.logo_url,
        special: hub?.special ?? "", special_es: hub?.special_es ?? "", wifi_name: hub?.wifi_name ?? "", wifi_password: hub?.wifi_password ?? "",
        google_review_url: hub?.google_review_url ?? "", instagram_url: hub?.instagram_url ?? "", tiktok_url: hub?.tiktok_url ?? "",
        loyalty_goal: hub?.loyalty_goal ?? 8, loyalty_reward: hub?.loyalty_reward ?? "", buttons: hub?.buttons ?? {}, theme: hub?.theme === "dark" ? "dark" : "light",
      }} />
    </>
  );
}
