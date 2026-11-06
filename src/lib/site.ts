import "server-only";
import { headers } from "next/headers";

/** Base URL of this deployment, used in email links and QR codes. */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Readable tag codes: no 0/O, 1/I/L, so they are easy to read off a sticker. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newTagCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Only allow redirects to paths on this site. */
export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
