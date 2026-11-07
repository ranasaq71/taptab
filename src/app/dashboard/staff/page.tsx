import { requireLocation } from "@/lib/auth/session";
import { smsEnabled } from "@/lib/sms";
import StaffEditor from "./StaffEditor";

export const metadata = { title: "Staff alerts · TapTab" };

export default async function StaffPage() {
  const { db, location } = await requireLocation("/dashboard/staff", { edit: true });
  const [{ data: staff }, { data: tables }] = await Promise.all([
    db.from("staff_contacts").select("id, name, phone_e164, sections, alerts_on").eq("location_id", location.id).order("created_at"),
    db.from("dining_tables").select("section").eq("location_id", location.id),
  ]);
  const known = [...new Set((tables ?? []).map((t) => t.section?.toUpperCase()).filter(Boolean) as string[])].sort();
  return (
    <>
      <h1>Staff alerts</h1>
      <p className="muted">Text the right server when a table needs them.{smsEnabled() ? "" : " Until text alerts are switched on, requests still appear instantly on the Live screen."}</p>
      <StaffEditor smsOn={smsEnabled()} knownSections={known} staff={(staff ?? []).map((s) => ({ id: s.id, name: s.name, phone: s.phone_e164, sections: s.sections ?? [], alerts: s.alerts_on }))} />
    </>
  );
}
