import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isOrderStatus, normalizeOrderStatus, refillAlerts, type OrderStatus } from "./admin-logic";
import { isClaimStatus, returnCode, type ClaimStatus } from "./rewards-logic";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

/** Verifies the caller is an admin (as themselves), then hands back the privileged client. */
async function adminClient(ctx: Ctx) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !isAdmin) throw new Error("Forbidden: admins only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
};

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });

async function loadPeople(db: Awaited<ReturnType<typeof adminClient>>) {
  const profiles = must(await db.from("profiles").select("id, name, email, status, created_at").order("created_at", { ascending: false }));
  return new Map(profiles.map((p) => [p.id, p]));
}

export const getAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const [orders, items, meds, people] = await Promise.all([
      db.from("orders").select("*").order("created_at", { ascending: false }).limit(500).then(must),
      db.from("order_items").select("order_id, medication_id, quantity").then(must),
      db.from("medications").select("id, name, strength").then(must),
      loadPeople(db),
    ]);
    const medById = new Map(meds.map((m) => [m.id, m]));
    return orders.map((o) => {
      const it = items.find((i) => i.order_id === o.id);
      const med = it?.medication_id ? medById.get(it.medication_id) : undefined;
      const p = people.get(o.user_id);
      return {
        id: o.id, status: normalizeOrderStatus(o.status), pharmacy: o.pharmacy, createdAt: o.created_at, updatedAt: o.updated_at,
        quantity: it?.quantity ?? 0, medicine: med ? `${med.name} ${med.strength}`.trim() : "Medicine",
        userId: o.user_id, customer: p?.name || p?.email || "Unknown", email: p?.email ?? "",
      };
    });
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; status: OrderStatus }) => {
    if (typeof input?.orderId !== "string" || !input.orderId) throw new Error("Missing order");
    if (!isOrderStatus(input.status)) throw new Error("Unknown order status");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await adminClient(context);
    const res = await db.from("orders").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.orderId).select("user_id").maybeSingle();
    if (res.error) throw new Error(res.error.message);
    const order = res.data;
    if (!order) throw new Error("Order not found");
    await db.from("audit_logs").insert({ user_id: order.user_id, actor_user_id: context.userId, action: `Order marked ${data.status}`, resource_type: "order", resource_id: data.orderId });
    return { ok: true };
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const [people, meds, orders, uploads, roles] = await Promise.all([
      loadPeople(db),
      db.from("medications").select("user_id, status").then(must),
      db.from("orders").select("user_id").then(must),
      db.from("prescriptions").select("user_id").is("deleted_at", null).then(must),
      db.from("user_roles").select("user_id, role").then(must),
    ]);
    const count = <T extends { user_id: string }>(rows: T[], id: string) => rows.filter((r) => r.user_id === id).length;
    return [...people.values()].map((p) => ({
      id: p.id, name: p.name, email: p.email, status: p.status, joined: p.created_at,
      activeMeds: meds.filter((m) => m.user_id === p.id && m.status === "active").length,
      orders: count(orders, p.id), uploads: count(uploads, p.id),
      isAdmin: roles.some((r) => r.user_id === p.id && r.role === "admin"),
      isYou: p.id === context.userId,
    }));
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; suspended: boolean }) => {
    if (typeof input?.userId !== "string" || !input.userId) throw new Error("Missing user");
    return { userId: input.userId, suspended: input.suspended === true };
  })
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You can't suspend your own account");
    const db = await adminClient(context);
    // The sign-in ban is the real lock; the profile status is what the panel shows.
    const ban = await db.auth.admin.updateUserById(data.userId, { ban_duration: data.suspended ? "876000h" : "none" });
    if (ban.error) throw new Error(ban.error.message);
    must(await db.from("profiles").update({ status: data.suspended ? "suspended" : "active", updated_at: new Date().toISOString() }).eq("id", data.userId).select("id"));
    await db.from("audit_logs").insert({ user_id: data.userId, actor_user_id: context.userId, action: data.suspended ? "Account suspended by admin" : "Account reactivated by admin", resource_type: "profile", resource_id: data.userId });
    return { ok: true };
  });

export const getAdminUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const [rx, items, people] = await Promise.all([
      db.from("prescriptions").select("id, user_id, processing_status, overall_confidence, uploaded_at, image_storage_key").is("deleted_at", null).order("uploaded_at", { ascending: false }).limit(300).then(must),
      db.from("prescription_items").select("prescription_id, user_verified").then(must),
      loadPeople(db),
    ]);
    return rx.map((r) => {
      const mine = items.filter((i) => i.prescription_id === r.id);
      const p = people.get(r.user_id);
      return {
        id: r.id, status: r.processing_status, confidence: r.overall_confidence === null ? null : Number(r.overall_confidence),
        uploadedAt: r.uploaded_at, hasFile: !!r.image_storage_key, medicines: mine.length, verified: mine.filter((i) => i.user_verified).length,
        customer: p?.name || p?.email || "Unknown", email: p?.email ?? "",
      };
    });
  });

export const getUploadLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (typeof input?.id !== "string" || !input.id) throw new Error("Missing upload");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await adminClient(context);
    const { data: row, error } = await db.from("prescriptions").select("image_storage_key").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.image_storage_key) throw new Error("No file for this upload");
    const signed = await db.storage.from("prescriptions").createSignedUrl(row.image_storage_key, 300);
    if (signed.error) throw new Error(signed.error.message);
    return { url: signed.data.signedUrl };
  });

export const getRefillAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const [refills, meds, scheds, prefs, people] = await Promise.all([
      db.from("refills").select("medication_id, user_id, remaining_quantity").then(must),
      db.from("medications").select("id, name, strength, status").eq("status", "active").then(must),
      db.from("medication_schedules").select("medication_id, doses_per_day").then(must),
      db.from("notification_preferences").select("user_id, refill_days").then(must),
      loadPeople(db),
    ]);
    const medById = new Map(meds.map((m) => [m.id, m]));
    const rows = refills.filter((r) => medById.has(r.medication_id)).map((r) => {
      const m = medById.get(r.medication_id)!;
      const p = people.get(r.user_id);
      return {
        medicationId: r.medication_id, userId: r.user_id, remaining: r.remaining_quantity,
        dosesPerDay: scheds.find((s) => s.medication_id === r.medication_id)?.doses_per_day ?? 1,
        thresholdDays: prefs.find((x) => x.user_id === r.user_id)?.refill_days ?? 5,
        medicine: `${m.name} ${m.strength}`.trim(), customer: p?.name || p?.email || "Unknown", email: p?.email ?? "",
      };
    });
    return refillAlerts(rows);
  });

export const getAdminRecycling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient(context);
    const [subs, claims, people] = await Promise.all([
      db.from("recycling_submissions").select("*").order("created_at", { ascending: false }).limit(500).then(must),
      db.from("reward_claims").select("*").order("created_at", { ascending: false }).limit(500).then(must),
      loadPeople(db),
    ]);
    const totals = new Map<string, number>();
    for (const s of subs) if (s.status === "verified") totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + (s.verified_count ?? 0));
    const who = (id: string) => { const p = people.get(id); return { customer: p?.name || p?.email || "Unknown", email: p?.email ?? "" }; };
    return {
      returns: subs.map((s) => ({
        id: s.id, code: returnCode(s.id), userId: s.user_id, ...who(s.user_id), wrappers: s.wrappers, bottles: s.bottles, expired: s.expired,
        declared: s.wrappers + s.bottles + s.expired, tracking: s.tracking_number, note: s.note, status: s.status,
        verifiedCount: s.verified_count, createdAt: s.created_at, verifiedAt: s.verified_at, userTotal: totals.get(s.user_id) ?? 0,
      })),
      claims: claims.map((c) => ({
        id: c.id, userId: c.user_id, ...who(c.user_id), tier: c.tier, seeds: c.seeds, shipName: c.ship_name, shipAddress: c.ship_address,
        shipPhone: c.ship_phone, status: isClaimStatus(c.status) ? c.status : "processing", createdAt: c.created_at,
      })),
    };
  });

export const verifyReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; count: number; reject?: boolean }) => {
    if (typeof input?.id !== "string" || !input.id) throw new Error("Missing parcel");
    const n = Number(input.count);
    const reject = input.reject === true;
    if (!reject && (!Number.isInteger(n) || n < 0 || n > 1500)) throw new Error("Enter the number of items you counted");
    return { id: input.id, count: reject ? 0 : n, reject };
  })
  .handler(async ({ data, context }) => {
    const db = await adminClient(context);
    // Only parcels still waiting can be credited, so points are never added twice.
    const res = await db.from("recycling_submissions").update({
      status: data.reject ? "rejected" : "verified", verified_count: data.count, verified_at: new Date().toISOString(),
      verified_by: context.userId, updated_at: new Date().toISOString(),
    }).eq("id", data.id).eq("status", "pending").select("user_id").maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("This parcel was already checked");
    await db.from("audit_logs").insert({ user_id: res.data.user_id, actor_user_id: context.userId, action: data.reject ? "Recycling parcel not accepted" : `Recycling parcel credited ${data.count} items`, resource_type: "recycling_submission", resource_id: data.id });
    return { ok: true };
  });

export const updateClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: ClaimStatus }) => {
    if (typeof input?.id !== "string" || !input.id) throw new Error("Missing seed order");
    if (!isClaimStatus(input.status)) throw new Error("Unknown status");
    return input;
  })
  .handler(async ({ data, context }) => {
    const db = await adminClient(context);
    const res = await db.from("reward_claims").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id).select("user_id").maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) throw new Error("Seed order not found");
    await db.from("audit_logs").insert({ user_id: res.data.user_id, actor_user_id: context.userId, action: `Seed order marked ${data.status}`, resource_type: "reward_claim", resource_id: data.id });
    return { ok: true };
  });
