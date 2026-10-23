import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_ITEMS_PER_TYPE, isRewardTier, returnCode, seedChoiceError, verifiedTotal, canClaim, type RewardTier, type SeedId,
} from "./rewards-logic";

const count = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ITEMS_PER_TYPE) throw new Error(`Enter a whole number from 0 to ${MAX_ITEMS_PER_TYPE}`);
  return n;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The signed-in user's returns, claims and lifetime verified total. */
export const getMyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [subs, claims] = await Promise.all([
      db.from("recycling_submissions").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
      db.from("reward_claims").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
    ]);
    if (subs.error) throw new Error(subs.error.message);
    if (claims.error) throw new Error(claims.error.message);
    return {
      total: verifiedTotal(subs.data),
      submissions: subs.data.map((s) => ({ ...s, code: returnCode(s.id) })),
      claims: claims.data,
    };
  });

export const submitReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { wrappers: number; bottles: number; expired: number; tracking?: string; note?: string }) => {
    const out = { wrappers: count(input?.wrappers), bottles: count(input?.bottles), expired: count(input?.expired), tracking: text(input?.tracking, 80), note: text(input?.note, 300) };
    if (out.wrappers + out.bottles + out.expired === 0) throw new Error("Add at least one item you're sending");
    return out;
  })
  .handler(async ({ data, context }) => {
    const res = await context.supabase.from("recycling_submissions").insert({
      user_id: context.userId, wrappers: data.wrappers, bottles: data.bottles, expired: data.expired, tracking_number: data.tracking, note: data.note,
    }).select("id").single();
    if (res.error) throw new Error(res.error.message);
    return { id: res.data.id, code: returnCode(res.data.id) };
  });

export const claimReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tier: RewardTier; seeds: SeedId[]; name: string; address: string; phone?: string }) => {
    if (!isRewardTier(input?.tier)) throw new Error("Unknown reward");
    const seeds = Array.isArray(input.seeds) ? input.seeds : [];
    const err = seedChoiceError(seeds);
    if (err) throw new Error(err);
    const name = text(input.name, 120), address = text(input.address, 500), phone = text(input.phone, 30);
    if (!name || address.length < 10) throw new Error("Add a delivery name and full address");
    return { tier: input.tier, seeds, name, address, phone };
  })
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const [subs, claims] = await Promise.all([
      db.from("recycling_submissions").select("status, verified_count").eq("user_id", context.userId),
      db.from("reward_claims").select("tier").eq("user_id", context.userId),
    ]);
    if (subs.error || claims.error) throw new Error("Couldn't check your progress. Try again.");
    const total = verifiedTotal(subs.data);
    if (!canClaim(total, data.tier, claims.data.map((c) => c.tier))) {
      throw new Error(total < data.tier ? `You need ${data.tier} checked items to claim this (you have ${total}).` : "You've already claimed this reward.");
    }
    // The database re-checks the total before saving, so this can't be bypassed.
    const res = await db.from("reward_claims").insert({
      user_id: context.userId, tier: data.tier, seeds: data.seeds, ship_name: data.name, ship_address: data.address, ship_phone: data.phone,
    }).select("id").single();
    if (res.error) throw new Error(res.error.code === "23505" ? "You've already claimed this reward." : res.error.message);
    return { id: res.data.id };
  });
