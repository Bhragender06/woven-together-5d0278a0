import { uid, type DoseLog, type Medication, type State } from "./store";

export type PersonaId = "savita" | "rahul";
type MedSeed = Omit<Medication, "id" | "startDate" | "source" | "status" | "durationDays"> & { durationDays?: number | null };

export const personas: Record<PersonaId, { label: string; tagline: string; meds: MedSeed[]; returns: { wrappers: number; bottles: number; expired: number } }> = {
  savita: {
    label: "Grandma Savita",
    tagline: "72 · Diabetes & BP",
    returns: { wrappers: 14, bottles: 2, expired: 3 },
    meds: [
      { name: "Metformin", strength: "500 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Twice daily", times: [], instructions: "With meals", quantity: 60, remaining: 6, dosesPerDay: 2 },
      { name: "Amlodipine", strength: "5 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily", times: [], instructions: "Morning", quantity: 30, remaining: 22, dosesPerDay: 1 },
      { name: "Aspirin", strength: "75 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily", times: [], instructions: "After food", quantity: 30, remaining: 18, dosesPerDay: 1 },
      { name: "Ibuprofen", strength: "400 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Twice daily", times: [], instructions: "For knee pain, after food", quantity: 20, remaining: 12, dosesPerDay: 2 },
    ],
  },
  rahul: {
    label: "Rahul",
    tagline: "28 · Asthma & Allergies",
    returns: { wrappers: 8, bottles: 1, expired: 1 },
    meds: [
      { name: "Montelukast", strength: "10 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily", times: [], instructions: "At bedtime", quantity: 30, remaining: 4, dosesPerDay: 1 },
      { name: "Salbutamol inhaler", strength: "100 mcg", form: "Inhaler", dose: "2 puffs", route: "Inhaled", frequency: "Twice daily", times: [], instructions: "Shake well", quantity: 200, remaining: 120, dosesPerDay: 2 },
      { name: "Cetirizine", strength: "10 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily", times: [], instructions: "May cause drowsiness", quantity: 30, remaining: 20, dosesPerDay: 1 },
      { name: "Propranolol", strength: "40 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Twice daily", times: [], instructions: "For migraine (new prescription)", quantity: 60, remaining: 56, dosesPerDay: 2 },
    ],
  },
};

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const shift = (now: Date, min: number) => { const d = new Date(now); d.setMinutes(d.getMinutes() + min); return hhmm(d); };

/** Builds a demo plan relative to `now`: one missed dose, one due in 10 minutes, the rest later. */
export function buildPersona(s: State, id: PersonaId, now = new Date()): State {
  const p = personas[id];
  const date = now.toISOString().slice(0, 10);
  const slots = [[-120, 10], [-60], [-180], [10, 360]];
  const meds: Medication[] = p.meds.map((m, i) => {
    const times = (m.dosesPerDay === 1 ? [slots[i % 4]![0]!] : slots[i % 4]!.length === 2 ? slots[i % 4]! : [slots[i % 4]![0]!, 300])
      .map((o) => shift(now, o)).sort();
    return { ...m, id: uid(), times, startDate: date, durationDays: m.durationDays ?? null, source: "prescription", status: "active" };
  });
  const logs: DoseLog[] = [];
  const first = meds[0]!; const second = meds[1]!;
  logs.push({ id: uid(), medId: first.id, date, time: first.times[0]!, status: "missed", at: now.toISOString() });
  logs.push({ id: uid(), medId: second.id, date, time: second.times[0]!, status: "taken", at: now.toISOString() });
  return {
    ...s,
    onboarded: true,
    meds: [...s.meds.map((m) => ({ ...m, status: "archived" as const })), ...meds],
    logs: [...logs, ...s.logs],
  };
}
