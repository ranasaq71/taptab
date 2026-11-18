import "server-only";

/**
 * Google Business Profile API (reviews + posts). Needs, in Vercel:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (OAuth client from Google Cloud)
 * and Google's approval of the project for the Business Profile APIs.
 */
export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/business.manage"];
export const googleReady = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export class GoogleError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

export function authUrl(redirectUri: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code",
    scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(data.error_description || data.error || "Google sign-in failed", res.status);
  return data as { access_token: string; refresh_token?: string; id_token?: string; expires_in: number };
}

export const exchangeCode = (code: string, redirectUri: string) => token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
export const accessToken = async (refresh: string) => (await token({ refresh_token: refresh, grant_type: "refresh_token" })).access_token;

/** Email inside Google's id_token (no signature check needed: it came straight from Google's token endpoint). */
export function emailFromIdToken(idToken?: string) {
  try { return JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString()).email as string; } catch { return null; }
}

async function api<T>(at: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${at}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message ?? res.statusText;
    if (res.status === 403 || res.status === 429) throw new GoogleError(`Google refused the request (${msg}). TapTab may still be waiting for Google's API approval.`, res.status);
    throw new GoogleError(msg, res.status);
  }
  return data as T;
}

export type GLocation = { account: string; name: string; title: string; address?: string };

/** Every business location the signed-in Google account manages. */
export async function listLocations(at: string): Promise<GLocation[]> {
  const { accounts = [] } = await api<{ accounts?: { name: string }[] }>(at, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
  const out: GLocation[] = [];
  for (const a of accounts) {
    let page = "";
    do {
      const r = await api<{ locations?: any[]; nextPageToken?: string }>(at,
        `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storefrontAddress&pageSize=100${page ? `&pageToken=${page}` : ""}`);
      for (const l of r.locations ?? []) out.push({ account: a.name, name: l.name, title: l.title, address: l.storefrontAddress?.addressLines?.join(", ") });
      page = r.nextPageToken ?? "";
    } while (page);
  }
  return out;
}

export type GReview = {
  name: string; reviewId: string; reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"; comment?: string; createTime: string; updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
};
export const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Newest reviews first (up to `max`). */
export async function listReviews(at: string, account: string, location: string, max = 100): Promise<GReview[]> {
  const out: GReview[] = []; let page = "";
  const loc = location.replace(/^.*locations\//, "locations/");
  do {
    const r = await api<{ reviews?: GReview[]; nextPageToken?: string }>(at,
      `https://mybusiness.googleapis.com/v4/${account}/${loc}/reviews?pageSize=50&orderBy=updateTime%20desc${page ? `&pageToken=${page}` : ""}`);
    out.push(...(r.reviews ?? [])); page = r.nextPageToken ?? "";
  } while (page && out.length < max);
  return out.slice(0, max);
}

export const putReply = (at: string, reviewName: string, comment: string) =>
  api(at, `https://mybusiness.googleapis.com/v4/${reviewName}/reply`, { method: "PUT", body: JSON.stringify({ comment }) });

export const createPost = (at: string, account: string, location: string, summary: string) =>
  api(at, `https://mybusiness.googleapis.com/v4/${account}/${location.replace(/^.*locations\//, "locations/")}/localPosts`,
    { method: "POST", body: JSON.stringify({ languageCode: "en-US", summary, topicType: "STANDARD" }) });
