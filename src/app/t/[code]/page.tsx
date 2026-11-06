import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadHubByTag, logEvent } from "@/lib/hub";
import Hub from "./Hub";

export const dynamic = "force-dynamic"; // every tap is counted, never cached

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ s?: string; preview?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hub = await loadHubByTag((await params).code);
  return { title: hub ? hub.location.name : "TapTab", robots: { index: false } };
}

export default async function TagPage({ params, searchParams }: Props) {
  const hub = await loadHubByTag((await params).code);
  if (!hub) notFound();
  const sp = await searchParams;
  // Owners previewing from their dashboard shouldn't inflate their own tap counts.
  if (sp.preview !== "1") await logEvent(hub, "tap", undefined, sp.s === "qr" ? "qr" : "nfc");
  return <Hub data={hub} />;
}
