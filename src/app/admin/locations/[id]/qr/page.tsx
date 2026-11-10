import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth/session";
import { siteUrl } from "@/lib/site";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "QR sheet · TapTab" };

export default async function LocationTags({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: loc } = await db.from("locations").select("id, name, brand_color").eq("id", id).maybeSingle();
  if (!loc) notFound();
  const { data: tables } = await db.from("dining_tables")
    .select("id, label, sort_order, tags(code, status, last_tap_at)").eq("location_id", id).order("sort_order");
  const base = await siteUrl();

  const rows = await Promise.all((tables ?? []).map(async (t: any) => {
    const tag = (t.tags ?? []).find((x: any) => x.status === "assigned");
    const nfcUrl = tag ? `${base}/t/${tag.code}` : null;
    const qr = tag ? await QRCode.toString(`${nfcUrl}?s=qr`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
    return { id: t.id, label: t.label, code: tag?.code as string | undefined, nfcUrl, qr, lastTap: tag?.last_tap_at as string | null };
  }));

  return (
    <>
      <div className="no-print">
        <p><Link href={`/admin/locations/${loc.id}`}>← Back to {loc.name}</Link></p>
        <h1>{loc.name}</h1>
        <p className="muted">Write each NFC link onto that table’s tag and lock it. Print the QR sheet for the backup stickers on each stand.</p>
        <PrintButton />
      </div>
      <div className="qr-grid">
        {rows.map((r) => (
          <article key={r.id} className="qr-card">
            <div className="qr-table">Table {r.label}</div>
            {r.qr ? <div className="qr" dangerouslySetInnerHTML={{ __html: r.qr }} /> : <p className="muted">No tag assigned</p>}
            <div className="qr-hint">Tap or scan for menu, Wi‑Fi &amp; more</div>
            {r.code && (
              <div className="qr-meta no-print">
                <code>{r.code}</code>
                <a href={r.nfcUrl!} target="_blank" rel="noopener">NFC link</a>
                <span className="muted small">{r.lastTap ? `Last tap ${new Date(r.lastTap).toLocaleDateString("en-US")}` : "Never tapped"}</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
