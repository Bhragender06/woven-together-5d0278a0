import { Field } from "@/components/site";

export type Draft = {
  name: string; strength: string; form: string; dose: string; route: string; frequency: string;
  times: string[]; instructions: string; durationDays: string; quantity: string;
};
export type Uncertain = Partial<Record<keyof Draft, string>>;

export const emptyDraft: Draft = {
  name: "", strength: "", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Once daily",
  times: ["09:00"], instructions: "", durationDays: "", quantity: "30",
};

export const freqTimes: Record<string, string[]> = {
  "Once daily": ["09:00"],
  "Twice daily": ["09:00", "21:00"],
  "Three times daily": ["08:00", "14:00", "21:00"],
  "Four times daily": ["08:00", "12:00", "16:00", "20:00"],
};

export function validateDraft(d: Draft): string | null {
  if (!d.name.trim()) return "Medicine name is required.";
  if (!d.strength.trim()) return "Strength is required.";
  if (!d.dose.trim()) return "Dose is required.";
  if (d.times.length === 0) return "Add at least one reminder time.";
  if (!(+d.quantity > 0)) return "Quantity must be a positive number.";
  return null;
}

export function MedForm({ d, onChange, uncertain = {} }: { d: Draft; onChange: (d: Draft) => void; uncertain?: Uncertain }) {
  const set = (p: Partial<Draft>) => onChange({ ...d, ...p });
  const cls = (k: keyof Draft) => `field ${uncertain[k] ? "border-warning bg-warning-soft" : ""}`;
  const hint = (k: keyof Draft) => uncertain[k] ? <span className="font-semibold text-warning">⚠ {uncertain[k]}</span> : undefined;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Medicine name" hint={hint("name")}><input className={cls("name")} value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Strength" hint={hint("strength")}><input className={cls("strength")} value={d.strength} placeholder="e.g. 500 mg" onChange={(e) => set({ strength: e.target.value })} /></Field>
      <Field label="Dose" hint={hint("dose")}><input className={cls("dose")} value={d.dose} onChange={(e) => set({ dose: e.target.value })} /></Field>
      <Field label="Form"><select className="field" value={d.form} onChange={(e) => set({ form: e.target.value })}>
        {["Tablet", "Capsule", "Syrup", "Drops", "Injection", "Inhaler", "Cream"].map((f) => <option key={f}>{f}</option>)}
      </select></Field>
      <Field label="How often" hint={hint("frequency")}><select className={cls("frequency")} value={d.frequency}
        onChange={(e) => set({ frequency: e.target.value, times: freqTimes[e.target.value] ?? d.times })}>
        {Object.keys(freqTimes).map((f) => <option key={f}>{f}</option>)}
      </select></Field>
      <Field label="Route"><select className="field" value={d.route} onChange={(e) => set({ route: e.target.value })}>
        {["Oral", "Topical", "Inhaled", "Injection", "Eye", "Ear"].map((f) => <option key={f}>{f}</option>)}
      </select></Field>
      <div className="md:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold">Reminder times</span>
        <div className="flex flex-wrap gap-2">
          {d.times.map((t, i) => (
            <div key={i} className="flex items-center gap-1">
              <input type="time" aria-label={`Time ${i + 1}`} className="field w-36" value={t}
                onChange={(e) => set({ times: d.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              {d.times.length > 1 && <button type="button" aria-label="Remove time" className="px-2 text-xl text-muted-foreground" onClick={() => set({ times: d.times.filter((_, j) => j !== i) })}>×</button>}
            </div>
          ))}
          <button type="button" className="rounded-md border border-dashed px-4 font-semibold" onClick={() => set({ times: [...d.times, "12:00"] })}>+ Add time</button>
        </div>
      </div>
      <Field label="Duration (days)" hint={hint("durationDays") ?? <span className="text-muted-foreground">Leave blank if ongoing</span>}>
        <input className={cls("durationDays")} inputMode="numeric" value={d.durationDays} onChange={(e) => set({ durationDays: e.target.value.replace(/\D/g, "") })} /></Field>
      <Field label="Quantity supplied" hint={hint("quantity")}><input className={cls("quantity")} inputMode="numeric" value={d.quantity} onChange={(e) => set({ quantity: e.target.value.replace(/\D/g, "") })} /></Field>
      <div className="md:col-span-2"><Field label="Instructions" hint={hint("instructions")}><input className={cls("instructions")} value={d.instructions} placeholder="e.g. after food" onChange={(e) => set({ instructions: e.target.value })} /></Field></div>
    </div>
  );
}

export function draftToMed(d: Draft, source: "prescription" | "manual") {
  const q = +d.quantity;
  return {
    name: d.name.trim(), strength: d.strength.trim(), form: d.form, dose: d.dose.trim(), route: d.route,
    frequency: d.frequency, times: [...d.times].sort(), instructions: d.instructions.trim(),
    startDate: new Date().toISOString().slice(0, 10), durationDays: d.durationDays ? +d.durationDays : null,
    quantity: q, remaining: q, dosesPerDay: d.times.length, source, status: "active" as const,
  };
}
