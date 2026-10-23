import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeOrderStatus } from "./admin-logic";
import { daysLeft, getState, onPersist, replaceState, signOut as clearLocal, emptyState, type DoseLog, type Medication, type Order, type State } from "./store";

/**
 * Keeps the in-memory store in sync with the normalized account tables.
 * Load: read every table and assemble the store. Save: diff against the last
 * synced snapshot and write only the rows that changed.
 */

let userId: string | null = null;
let synced: State | null = null;
let ready = false;
const readyListeners = new Set<() => void>();
const markReady = () => { ready = true; readyListeners.forEach((l) => l()); };
export const useAuthReady = () =>
  useSyncExternalStore((l) => { readyListeners.add(l); return () => readyListeners.delete(l); }, () => ready, () => false);

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const toDbStatus = (s: Medication["status"]) => (s === "archived" ? "discontinued" : s);
const fromDbStatus = (s: string): Medication["status"] => (s === "active" || s === "paused" ? s : "archived");

function refillStatus(m: Medication, thresholdDays: number) {
  const d = daysLeft(m);
  if (d <= 0) return "due";
  return d <= thresholdDays ? "approaching" : "not_due";
}

function runout(m: Medication) {
  const d = daysLeft(m);
  if (!Number.isFinite(d)) return null;
  const dt = new Date(); dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

async function loadAccount(u: { id: string; email?: string | undefined }) {
  if (userId === u.id) return;
  userId = u.id;
  const [prof, prefs, meds, scheds, refills, doses, orders, items, audit] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", u.id).maybeSingle(),
    supabase.from("medications").select("*").order("created_at"),
    supabase.from("medication_schedules").select("*"),
    supabase.from("refills").select("*"),
    supabase.from("dose_events").select("*").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("orders").select("*").order("created_at", { ascending: false }),
    supabase.from("order_items").select("*"),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  for (const r of [prof, prefs, meds, scheds, refills, doses, orders, items, audit]) if (r.error) console.error("Cloud load failed", r.error.message);

  const p = prof.data;
  const base = emptyState();
  const sById = new Map((scheds.data ?? []).map((s) => [s.medication_id, s]));
  const rById = new Map((refills.data ?? []).map((r) => [r.medication_id, r]));
  const next: State = {
    ...base,
    user: { name: p?.name || (u.email ?? "").split("@")[0] || "there", email: p?.email || u.email || "", mfa: p?.mfa_enabled ?? false, avatar: p?.avatar_url ?? undefined },
    onboarded: p?.onboarded ?? false,
    prefs: prefs.data ? {
      sound: prefs.data.sound, snoozeMinutes: prefs.data.snooze_minutes, missedWindow: prefs.data.missed_window, escalate: prefs.data.escalate,
      quietStart: prefs.data.quiet_start, quietEnd: prefs.data.quiet_end, refillDays: prefs.data.refill_days, push: prefs.data.push_enabled, email: prefs.data.email_enabled,
    } : base.prefs,
    meds: (meds.data ?? []).map((m): Medication => {
      const s = sById.get(m.id); const r = rById.get(m.id);
      return {
        id: m.id, name: m.name, strength: m.strength, form: m.form, dose: m.dosage, route: m.route, instructions: m.instructions,
        frequency: s?.frequency ?? "", times: s?.time_of_day ?? [], dosesPerDay: s?.doses_per_day ?? 1, durationDays: s?.duration_days ?? null,
        startDate: m.start_date, quantity: r?.quantity ?? 0, remaining: r?.remaining_quantity ?? 0,
        source: m.source === "prescription" ? "prescription" : "manual", status: fromDbStatus(m.status),
        ...(m.prescription_item_id ? { prescriptionItemId: m.prescription_item_id } : {}),
      };
    }),
    logs: (doses.data ?? []).map((d): DoseLog => ({ id: d.id, medId: d.medication_id, date: d.scheduled_date, time: d.scheduled_time, status: d.status === "upcoming" ? "snoozed" : (d.status as DoseLog["status"]), at: d.updated_at })),
    orders: (orders.data ?? []).map((o): Order => {
      const it = (items.data ?? []).find((i) => i.order_id === o.id);
      return { id: o.id, medId: it?.medication_id ?? "", qty: it?.quantity ?? 0, pharmacy: o.pharmacy, createdAt: o.created_at, status: normalizeOrderStatus(o.status) };
    }),
    audit: (audit.data ?? []).map((a) => ({ at: a.created_at, text: a.action })),
  };
  synced = next;
  replaceState(next);
  registerDevice(u.id);
}

async function registerDevice(uid: string) {
  const key = "medileaf-device-id";
  let id = localStorage.getItem(key);
  const row = { user_id: uid, device_name: navigator.userAgent.slice(0, 120), platform: "web", last_seen_at: new Date().toISOString() };
  if (id) {
    const { data } = await supabase.from("user_devices").update(row).eq("id", id).select("id");
    if (data?.length) return;
  }
  const { data } = await supabase.from("user_devices").insert(row).select("id").single();
  if (data) { id = data.id; localStorage.setItem(key, id); supabase.from("audit_logs").insert({ user_id: uid, actor_user_id: uid, action: "New device", resource_type: "device", resource_id: id }).then(); }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function push(s: State) {
  const uid = userId; const prev = synced;
  if (!uid || !prev) return;
  synced = s;
  const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
  const now = new Date().toISOString();

  if (s.user && (!same(prev.user, s.user) || prev.onboarded !== s.onboarded))
    ops.push(supabase.from("profiles").update({ name: s.user.name, mfa_enabled: s.user.mfa, avatar_url: s.user.avatar ?? null, onboarded: s.onboarded, timezone: tz(), updated_at: now }).eq("id", uid));

  if (!same(prev.prefs, s.prefs)) {
    const p = s.prefs;
    ops.push(supabase.from("notification_preferences").upsert({ user_id: uid, push_enabled: p.push, email_enabled: p.email, sound: p.sound, snooze_minutes: p.snoozeMinutes, missed_window: p.missedWindow, escalate: p.escalate, refill_days: p.refillDays, quiet_start: p.quietStart, quiet_end: p.quietEnd, updated_at: now }, { onConflict: "user_id" }));
  }

  // Medications (+ schedule + refill). Parents must exist before dose events and orders.
  const prevMeds = new Map(prev.meds.map((m) => [m.id, m]));
  const changedMeds = s.meds.filter((m) => !same(prevMeds.get(m.id), m));
  if (changedMeds.length) {
    const r1 = await supabase.from("medications").upsert(changedMeds.map((m) => ({
      id: m.id, user_id: uid, name: m.name, strength: m.strength, dosage: m.dose, form: m.form, route: m.route, instructions: m.instructions,
      source: m.source, status: toDbStatus(m.status), start_date: m.startDate, prescription_item_id: m.prescriptionItemId ?? null, updated_at: now,
    })));
    if (r1.error) console.error("Save medicines failed", r1.error.message);
    const r2 = await supabase.from("medication_schedules").upsert(changedMeds.map((m) => ({
      id: m.id, medication_id: m.id, user_id: uid, frequency: m.frequency, dose_amount: m.dose, time_of_day: m.times, doses_per_day: m.dosesPerDay,
      duration_days: m.durationDays, timezone: tz(), start_date: m.startDate, active: m.status === "active", updated_at: now,
    })), { onConflict: "medication_id" });
    if (r2.error) console.error("Save schedules failed", r2.error.message);
    ops.push(supabase.from("refills").upsert(changedMeds.map((m) => ({
      medication_id: m.id, user_id: uid, quantity: m.quantity, remaining_quantity: m.remaining, estimated_runout_date: runout(m), refill_status: refillStatus(m, s.prefs.refillDays), updated_at: now,
    })), { onConflict: "medication_id" }));
  }
  const removedMeds = prev.meds.filter((m) => !s.meds.some((x) => x.id === m.id)).map((m) => m.id);
  if (removedMeds.length) ops.push(supabase.from("medications").delete().in("id", removedMeds));

  // Dose events
  const prevLogs = new Map(prev.logs.map((l) => [l.id, l]));
  const changedLogs = s.logs.filter((l) => !same(prevLogs.get(l.id), l) && s.meds.some((m) => m.id === l.medId));
  const removedLogs = prev.logs.filter((l) => !s.logs.some((x) => x.id === l.id)).map((l) => l.id);
  if (removedLogs.length) await supabase.from("dose_events").delete().in("id", removedLogs);
  if (changedLogs.length) ops.push(supabase.from("dose_events").upsert(changedLogs.map((l) => ({
    id: l.id, schedule_id: l.medId, medication_id: l.medId, user_id: uid, scheduled_date: l.date, scheduled_time: l.time,
    scheduled_at: new Date(`${l.date}T${l.time}:00`).toISOString(), status: l.status,
    taken_at: l.status === "taken" ? l.at : null, skipped_at: l.status === "skipped" ? l.at : null, updated_at: now,
  })), { onConflict: "schedule_id,scheduled_date,scheduled_time" }));

  // Orders
  const newOrders = s.orders.filter((o) => !prev.orders.some((x) => x.id === o.id));
  for (const o of newOrders) {
    const r = await supabase.from("orders").insert({ id: o.id, user_id: uid, status: "submitted", pharmacy: o.pharmacy, created_at: o.createdAt, submitted_at: o.createdAt });
    if (r.error) { console.error("Save order failed", r.error.message); continue; }
    ops.push(supabase.from("order_items").insert({ order_id: o.id, user_id: uid, medication_id: o.medId || null, quantity: o.qty }));
  }

  // Activity log (append-only, no medical detail beyond the action text)
  const newAudit = s.audit.filter((a) => !prev.audit.some((x) => x.at === a.at && x.text === a.text));
  if (newAudit.length) ops.push(supabase.from("audit_logs").insert(newAudit.map((a) => ({ user_id: uid, actor_user_id: uid, action: a.text, created_at: a.at }))));

  const results = await Promise.all(ops);
  for (const r of results) if (r.error) console.error("Cloud save failed", r.error.message);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<void> = Promise.resolve();
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { chain = chain.then(() => push(getState())).catch((e) => console.error(e)); }, 500);
}

let started = false;
export function startCloudSync() {
  if (started) return;
  started = true;
  onPersist(save);
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) { const u = session.user; setTimeout(() => loadAccount(u).finally(markReady), 0); }
    else if (event === "SIGNED_OUT") { userId = null; synced = null; clearLocal(); }
  });
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session?.user) await loadAccount(data.session.user);
    else if (getState().user) clearLocal();
    markReady();
  });
}

export async function cloudSignOut() {
  await chain;
  if (userId) await supabase.from("audit_logs").insert({ user_id: userId, actor_user_id: userId, action: "Logout" });
  await supabase.auth.signOut();
  userId = null; synced = null;
  clearLocal();
}

/** Deletes every record tied to the account (all tables cascade from the profile). */
export async function deleteAccountData() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: files } = await supabase.storage.from("prescriptions").list(data.user.id);
  if (files?.length) await supabase.storage.from("prescriptions").remove(files.map((f) => `${data.user!.id}/${f.name}`));
  await supabase.from("profiles").delete().eq("id", data.user.id);
}
