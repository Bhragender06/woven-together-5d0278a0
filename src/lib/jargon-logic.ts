// Pure rules for the plain-language translator. No AI here.

export type Acronym = { code: string; latin: string; meaning: string };

export const ACRONYMS: Acronym[] = [
  { code: "PO", latin: "per os", meaning: "By mouth (swallow it)" },
  { code: "OD", latin: "omni die", meaning: "Once a day" },
  { code: "QD", latin: "quaque die", meaning: "Once a day" },
  { code: "BID", latin: "bis in die", meaning: "Twice a day" },
  { code: "BD", latin: "bis die", meaning: "Twice a day" },
  { code: "TID", latin: "ter in die", meaning: "Three times a day" },
  { code: "TDS", latin: "ter die sumendum", meaning: "Three times a day" },
  { code: "QID", latin: "quater in die", meaning: "Four times a day" },
  { code: "QHS", latin: "quaque hora somni", meaning: "Every night at bedtime" },
  { code: "HS", latin: "hora somni", meaning: "At bedtime" },
  { code: "AC", latin: "ante cibum", meaning: "Before meals (about 30 minutes before food)" },
  { code: "PC", latin: "post cibum", meaning: "After meals" },
  { code: "PRN", latin: "pro re nata", meaning: "Only when needed (for example, when in pain)" },
  { code: "SOS", latin: "si opus sit", meaning: "Only if needed" },
  { code: "STAT", latin: "statim", meaning: "Right away, now" },
  { code: "NPO", latin: "nil per os", meaning: "Nothing by mouth (no food or drink)" },
  { code: "SL", latin: "sub lingua", meaning: "Under the tongue — let it melt" },
  { code: "TOP", latin: "topical", meaning: "Put on the skin" },
  { code: "INH", latin: "inhalation", meaning: "Breathe it in" },
  { code: "IM", latin: "intramuscular", meaning: "Injection into a muscle" },
  { code: "IV", latin: "intravenous", meaning: "Into a vein (drip or injection)" },
  { code: "SC", latin: "subcutaneous", meaning: "Injection just under the skin" },
  { code: "QAM", latin: "quaque ante meridiem", meaning: "Every morning" },
  { code: "QPM", latin: "quaque post meridiem", meaning: "Every evening" },
  { code: "Q4H", latin: "quaque 4 hora", meaning: "Every 4 hours" },
  { code: "Q6H", latin: "quaque 6 hora", meaning: "Every 6 hours" },
  { code: "Q8H", latin: "quaque 8 hora", meaning: "Every 8 hours" },
  { code: "Q12H", latin: "quaque 12 hora", meaning: "Every 12 hours" },
  { code: "TAB", latin: "tabella", meaning: "Tablet" },
  { code: "CAP", latin: "capsula", meaning: "Capsule" },
  { code: "GTT", latin: "guttae", meaning: "Drops" },
  { code: "RX", latin: "recipe", meaning: "Prescription (\"take this\")" },
];

const BY_CODE = new Map(ACRONYMS.map((a) => [a.code, a]));

/** Finds known abbreviations in text, in order of first appearance, no duplicates. */
export function detectAcronyms(text: string): Acronym[] {
  const seen = new Set<string>();
  const out: Acronym[] = [];
  for (const raw of text.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
    const code = raw.toUpperCase();
    if (seen.has(code)) continue;
    // Lowercase words like "od", "po" in normal sentences are ambiguous; only accept all-caps or "Rx".
    if (raw !== code && code !== "RX") continue;
    const a = BY_CODE.get(code);
    if (a) { seen.add(code); out.push(a); }
  }
  return out;
}

export type DaySlot = "morning" | "afternoon" | "evening" | "night";
export const SLOT_LABEL: Record<DaySlot, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
export const SLOT_ICON: Record<DaySlot, string> = { morning: "🌅", afternoon: "☀️", evening: "🌇", night: "🌙" };

/** Maps a 24h "HH:MM" time to a part of the day. */
export function daySlot(time: string): DaySlot {
  const h = Number(time.split(":")[0]);
  if (!Number.isFinite(h)) return "morning";
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export type MealCue = "before_food" | "with_food" | "after_food" | "empty_stomach" | "bedtime" | "any";
export const MEAL_LABEL: Record<MealCue, string> = {
  before_food: "Before food", with_food: "With food", after_food: "After food",
  empty_stomach: "Empty stomach", bedtime: "At bedtime", any: "Any time",
};

export type TimelineDose = { time: string; medicine: string; amount: string; meal: MealCue; note: string };
export type PlainMedicine = { name: string; plain: string; asNeeded: boolean; durationText: string; tips: string[] };
export type PlainReport = { summary: string; medicines: PlainMedicine[]; timeline: TimelineDose[]; warnings: string[] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cleans AI timeline output: valid times only, sorted, capped. */
export function normalizeTimeline(items: TimelineDose[], max = 24): TimelineDose[] {
  return items
    .filter((d) => HHMM.test(d.time) && d.medicine.trim())
    .map((d) => ({ ...d, medicine: d.medicine.trim().slice(0, 80), amount: d.amount.trim().slice(0, 60), note: d.note.trim().slice(0, 160) }))
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, max);
}

export const SAMPLES: { label: string; text: string }[] = [
  { label: "Antibiotic course", text: "Rx: Amoxicillin 500mg cap PO TID AC x 7d. Paracetamol 650mg tab PO Q6H PRN fever/pain, max 4 tabs/day." },
  { label: "Diabetes & BP", text: "Metformin 500mg tab PO BID PC. Glimepiride 1mg PO OD AC (breakfast). Amlodipine 5mg PO QAM. Atorvastatin 10mg PO QHS." },
  { label: "Asthma & allergy", text: "Salbutamol INH 2 puffs PRN SOB. Budesonide INH 1 puff BID, rinse mouth. Cetirizine 10mg PO HS." },
];
