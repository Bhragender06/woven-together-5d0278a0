export type ScanCategory = "wrapper" | "bottle" | "expired";
export type Detection = { category: ScanCategory; label: string; box: [number, number, number, number]; confidence: number };
export type ScanResult = { wrappers: number; bottles: number; expired: number; detections: Detection[]; summary: string };

export const CATEGORY_LABEL: Record<ScanCategory, string> = { wrapper: "Foil strips", bottle: "Bottles", expired: "Expired packs" };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** Cleans AI output: keeps valid boxes (0-1000 scale), and counts each category from the boxes. */
export function normalizeScan(raw: { detections: { category: string; label: string; box: number[]; confidence: number }[]; summary: string }): ScanResult {
  const detections: Detection[] = [];
  for (const d of raw.detections ?? []) {
    if (!["wrapper", "bottle", "expired"].includes(d.category) || !Array.isArray(d.box) || d.box.length !== 4) continue;
    const [a, b, c, e] = d.box.map((n) => clamp(n, 0, 1000));
    const box: Detection["box"] = [Math.min(a!, c!), Math.min(b!, e!), Math.max(a!, c!), Math.max(b!, e!)];
    if (box[2] - box[0] < 5 || box[3] - box[1] < 5) continue;
    detections.push({ category: d.category as ScanCategory, label: String(d.label ?? "").trim().slice(0, 40), box, confidence: clamp(d.confidence, 0, 1) });
    if (detections.length >= 200) break;
  }
  const count = (c: ScanCategory) => detections.filter((d) => d.category === c).length;
  return { wrappers: count("wrapper"), bottles: count("bottle"), expired: count("expired"), detections, summary: String(raw.summary ?? "").trim().slice(0, 200) };
}

export const scanTotal = (s: Pick<ScanResult, "wrappers" | "bottles" | "expired">) => s.wrappers + s.bottles + s.expired;
