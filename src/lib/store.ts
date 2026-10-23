import { useSyncExternalStore } from "react";
import type { OrderStatus } from "./admin-logic";

export type DoseStatus = "taken" | "skipped" | "missed" | "snoozed";
export type Medication = {
  id: string;
  name: string;
  strength: string;
  form: string;
  dose: string;
  route: string;
  frequency: string;
  times: string[];
  instructions: string;
  startDate: string;
  durationDays: number | null;
  quantity: number;
  remaining: number;
  dosesPerDay: number;
  source: "prescription" | "manual";
  status: "active" | "paused" | "archived";
  prescriptionItemId?: string | undefined;
};
export type DoseLog = { id: string; medId: string; date: string; time: string; status: DoseStatus; at: string };
export type Order = { id: string; medId: string; qty: number; pharmacy: string; createdAt: string; status: OrderStatus };
export type Prefs = {
  sound: boolean;
  snoozeMinutes: number;
  missedWindow: number;
  escalate: boolean;
  quietStart: string;
  quietEnd: string;
  refillDays: number;
  push: boolean;
  email: boolean;
};
export type State = {
  user: { name: string; email: string; mfa: boolean; avatar?: string | undefined } | null;
  onboarded: boolean;
  meds: Medication[];
  logs: DoseLog[];
  orders: Order[];
  prefs: Prefs;
  audit: { at: string; text: string }[];
};

const KEY = "clearscript-v1";
const defaults: State = {
  user: null,
  onboarded: false,
  meds: [],
  logs: [],
  orders: [],
  prefs: {
    sound: true, snoozeMinutes: 10, missedWindow: 60, escalate: true,
    quietStart: "22:30", quietEnd: "07:00", refillDays: 5, push: true, email: false,
  },
  audit: [],
};

let state: State = defaults;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

export function getState() { load(); return state; }

export function setState(fn: (s: State) => State, auditText?: string) {
  load();
  state = fn(state);
  if (auditText) state = { ...state, audit: [{ at: new Date().toISOString(), text: auditText }, ...state.audit].slice(0, 50) };
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
  persistHooks.forEach((h) => h(state));
}

/** Replace the whole state (used when loading an account from the cloud). Does not trigger cloud save. */
export function replaceState(next: State) {
  state = { ...defaults, ...next, prefs: { ...defaults.prefs, ...(next.prefs ?? {}) } };
  loaded = true;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
export const emptyState = () => defaults;
const persistHooks = new Set<(s: State) => void>();
export function onPersist(h: (s: State) => void) { persistHooks.add(h); return () => persistHooks.delete(h); }

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => sel(getState()),
    () => sel(defaults),
  );
}

export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);

/** Days of supply left, given remaining units and daily dose count. */
export function daysLeft(m: Pick<Medication, "remaining" | "dosesPerDay">) {
  if (m.dosesPerDay <= 0) return Infinity;
  return Math.floor(m.remaining / m.dosesPerDay);
}

export function needsRefill(m: Pick<Medication, "remaining" | "dosesPerDay">, thresholdDays: number) {
  return daysLeft(m) <= thresholdDays;
}

export function fmtTime(t: string) {
  const [h = 0, mm = 0] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ap}`;
}

export function logDose(medId: string, time: string, status: DoseStatus) {
  setState((s) => {
    const d = today();
    const logs = s.logs.filter((l) => !(l.medId === medId && l.date === d && l.time === time));
    const prev = s.logs.find((l) => l.medId === medId && l.date === d && l.time === time);
    let meds = s.meds;
    const delta = (status === "taken" ? 1 : 0) - (prev?.status === "taken" ? 1 : 0);
    if (delta) meds = s.meds.map((m) => (m.id === medId ? { ...m, remaining: Math.max(0, m.remaining - delta) } : m));
    return { ...s, meds, logs: [{ id: uid(), medId, date: d, time, status, at: new Date().toISOString() }, ...logs] };
  });
}

export function signOut() {
  replaceState(defaults);
}

/** Remove from the current plan without deleting medicine or dose history. */
export function removeMedicineFromPlan(s: State, medId: string): State {
  return { ...s, meds: s.meds.map((m) => m.id === medId ? { ...m, status: "archived" } : m) };
}

export function removeMedicine(medId: string) {
  const med = getState().meds.find((m) => m.id === medId);
  if (!med) return;
  setState((s) => removeMedicineFromPlan(s, medId), `Removed ${med.name} from current plan`);
}

export function seedDemo() {
  const meds: Medication[] = [
    { id: uid(), name: "Amoxicillin", strength: "500 mg", form: "Capsule", dose: "1 capsule", route: "Oral", frequency: "Three times daily", times: ["08:00", "14:00", "21:00"], instructions: "After food", startDate: today(), durationDays: 7, quantity: 21, remaining: 18, dosesPerDay: 3, source: "prescription", status: "active" },
    { id: uid(), name: "Metformin", strength: "850 mg", form: "Tablet", dose: "1 tablet", route: "Oral", frequency: "Twice daily", times: ["09:00", "21:00"], instructions: "With meals", startDate: today(), durationDays: null, quantity: 60, remaining: 8, dosesPerDay: 2, source: "manual", status: "active" },
  ];
  setState((s) => ({ ...s, meds }), "Added demo medications");
}
