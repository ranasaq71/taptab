// Pure functions that turn raw rows into the numbers and chart series on the Analytics page.

export type Ev = { type: string; created_at: string; source: string | null; table_id: string | null };
export type Rq = { kind: string; status: string; created_at: string; resolved_at: string | null };
export type Card = { opted_in_at: string; last_stamp_at: string | null };
export type Note = { stars: number | null; created_at: string };

export type Analytics = {
  rangeDays: number; taps: number; prevTaps: number;
  byDay: { label: string; value: number }[];
  byHour: { label: string; value: number }[];
  opens: { key: string; label: string; value: number }[];
  funnel: { label: string; value: number }[];
  notes: number; lowNotes: number;
  requests: { total: number; byKind: { label: string; value: number }[]; avgMin: number | null; under3Pct: number | null; busiestHour: string | null };
  tables: { label: string; value: number }[];
  nfc: number; qr: number;
  rewards: { newMembers: number; returning: number };
};

const OPEN_LABELS: Record<string, string> = { menu: "Menu", server: "Call server", wifi: "Wi‑Fi", review: "Review screen", loyalty: "Rewards card", instagram: "Instagram", tiktok: "TikTok" };
const KIND_LABELS: Record<string, string> = { help: "Needs help", check: "Bring the check", refill: "Refill" };
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;

export function compute(opts: { days: number; tz: string; events: Ev[]; prevTaps: number; requests: Rq[]; cards: Card[]; notes: Note[]; tableLabels: Record<string, string>; since: Date }): Analytics {
  const { days, tz, events, requests, cards, notes, tableLabels, since } = opts;
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const hourOf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" });
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" });
  const hour = (iso: string) => Number(hourOf.format(new Date(iso))) % 24;

  const taps = events.filter((e) => e.type === "tap");
  // Days, oldest to newest, in restaurant time
  const dayOrder: string[] = [], dayLabels: Record<string, string> = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const k = dayKey.format(d); if (!dayLabels[k]) { dayOrder.push(k); dayLabels[k] = dayLabel.format(d); } }
  const perDay: Record<string, number> = {}; taps.forEach((e) => { const k = dayKey.format(new Date(e.created_at)); perDay[k] = (perDay[k] ?? 0) + 1; });
  const perHour = Array(24).fill(0); taps.forEach((e) => perHour[hour(e.created_at)]++);

  const count = (t: string) => events.filter((e) => e.type === t).length;
  const opens = Object.keys(OPEN_LABELS).map((k) => ({ key: k, label: OPEN_LABELS[k], value: count(k) })).sort((a, b) => b.value - a.value);

  const done = requests.filter((r) => r.status === "done" && r.resolved_at);
  const mins = done.map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 60000);
  const reqHour = Array(24).fill(0); requests.forEach((r) => reqHour[hour(r.created_at)]++);
  const peak = reqHour.indexOf(Math.max(...reqHour));

  const perTable: Record<string, number> = {}; taps.forEach((e) => { if (e.table_id) perTable[e.table_id] = (perTable[e.table_id] ?? 0) + 1; });

  return {
    rangeDays: days, taps: taps.length, prevTaps: opts.prevTaps,
    byDay: dayOrder.map((k) => ({ label: dayLabels[k], value: perDay[k] ?? 0 })),
    byHour: perHour.map((v, h) => ({ label: hourLabel(h), value: v })),
    opens,
    funnel: [{ label: "Guests who tapped", value: taps.length }, { label: "Opened the review screen", value: count("review") }, { label: "Went on to Google", value: count("google") }],
    notes: notes.length, lowNotes: notes.filter((n) => (n.stars ?? 5) <= 3).length,
    requests: {
      total: requests.length,
      byKind: Object.keys(KIND_LABELS).map((k) => ({ label: KIND_LABELS[k], value: requests.filter((r) => r.kind === k).length })),
      avgMin: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null,
      under3Pct: mins.length ? Math.round((mins.filter((m) => m <= 3).length / mins.length) * 100) : null,
      busiestHour: requests.length ? hourLabel(peak) : null,
    },
    tables: Object.entries(perTable).map(([id, v]) => ({ label: tableLabels[id] ?? "?", value: v })).sort((a, b) => b.value - a.value).slice(0, 8),
    nfc: taps.filter((e) => e.source !== "qr").length, qr: taps.filter((e) => e.source === "qr").length,
    rewards: {
      newMembers: cards.filter((c) => new Date(c.opted_in_at) >= since).length,
      returning: cards.filter((c) => new Date(c.opted_in_at) < since && c.last_stamp_at && new Date(c.last_stamp_at) >= since).length,
    },
  };
}
