// Pure rules for the AI Safety Shield (drug, food and duplicate-therapy checks).

export type SeverityLevel = "severe" | "moderate" | "dietary" | "info";
export type WarningKind = "drug" | "food" | "duplicate" | "lifestyle";
export type ShieldLevel = "danger" | "caution" | "clear";

export const SEVERITIES: SeverityLevel[] = ["severe", "moderate", "dietary", "info"];
export const KINDS: WarningKind[] = ["drug", "food", "duplicate", "lifestyle"];

export type InteractionWarning = {
  severity: SeverityLevel;
  kind: WarningKind;
  medicines: string[];
  title: string;
  explanation: string;
  advice: string;
  askDoctor: string;
};

export type SafetyReport = {
  level: ShieldLevel;
  summary: string;
  warnings: InteractionWarning[];
  checkedCount: number;
  checkedAt: string;
};

export type SafetyMed = { name: string; strength?: string; dose?: string; frequency?: string; instructions?: string };

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  severe: "Serious — talk to your doctor",
  moderate: "Take care",
  dietary: "Food & drink",
  info: "Good to know",
};

const rank: Record<SeverityLevel, number> = { severe: 0, moderate: 1, dietary: 2, info: 3 };

/** Overall shield colour: any serious warning is red; moderate or food warnings are amber; otherwise green. */
export function shieldLevel(warnings: Pick<InteractionWarning, "severity">[]): ShieldLevel {
  if (warnings.some((w) => w.severity === "severe")) return "danger";
  if (warnings.some((w) => w.severity === "moderate" || w.severity === "dietary")) return "caution";
  return "clear";
}

/** Count of warnings that need the patient's attention (everything except "good to know"). */
export function conflictCount(warnings: Pick<InteractionWarning, "severity">[]) {
  return warnings.filter((w) => w.severity !== "info").length;
}

export function sortWarnings<T extends Pick<InteractionWarning, "severity">>(warnings: T[]): T[] {
  return [...warnings].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Clean up raw AI output: drop unknown values, trim text, cap list length. */
export function normalizeWarnings(raw: unknown[], max = 12): InteractionWarning[] {
  const out: InteractionWarning[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const w = r as Record<string, unknown>;
    const severity = SEVERITIES.includes(w["severity"] as SeverityLevel) ? (w["severity"] as SeverityLevel) : null;
    const title = String(w["title"] ?? "").trim();
    if (!severity || !title) continue;
    const kind = KINDS.includes(w["kind"] as WarningKind) ? (w["kind"] as WarningKind) : "drug";
    const medicines = Array.isArray(w["medicines"]) ? w["medicines"].map((m) => String(m).split(",")[0]!.trim()).filter(Boolean).slice(0, 4) : [];
    out.push({
      severity, kind, medicines, title: title.slice(0, 140),
      explanation: String(w["explanation"] ?? "").trim().slice(0, 600),
      advice: String(w["advice"] ?? "").trim().slice(0, 400),
      askDoctor: String(w["askDoctor"] ?? "").trim().slice(0, 300),
    });
  }
  return sortWarnings(out).slice(0, max);
}

/** Stable key for a set of medicines, used to reuse a previous check when nothing changed. */
export function regimenKey(meds: SafetyMed[]) {
  return meds
    .map((m) => `${m.name.trim().toLowerCase()}|${(m.strength ?? "").trim().toLowerCase()}`)
    .filter((k) => k !== "|")
    .sort()
    .join(";");
}

export function shieldHeadline(level: ShieldLevel, warnings: InteractionWarning[], count: number) {
  const n = conflictCount(warnings);
  const meds = `${count} medicine${count === 1 ? "" : "s"}`;
  if (level === "clear") return `No known conflicts across ${meds}`;
  return `${n} thing${n === 1 ? "" : "s"} to check across ${meds}`;
}
