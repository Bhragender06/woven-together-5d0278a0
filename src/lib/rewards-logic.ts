/** Pure rules for the eco rewards program (shared by server functions, UI and tests). */

export const REWARD_TIERS = [
  { items: 50, name: "Flower seed packet" },
  { items: 100, name: "Garden starter kit" },
  { items: 150, name: "Premium herbal & floral box" },
] as const;
export type RewardTier = (typeof REWARD_TIERS)[number]["items"];

export const SEEDS = [
  { id: "sunflower", name: "Sunflower", note: "Tall, sunny and easy to grow" },
  { id: "marigold", name: "French marigold", note: "Bright orange blooms all summer" },
  { id: "lavender", name: "English lavender", note: "Calming scent, loved by bees" },
  { id: "wildflower", name: "Wildflower pollinator mix", note: "A meadow for bees and butterflies" },
  { id: "chamomile", name: "Chamomile", note: "Gentle white flowers for tea" },
] as const;
export type SeedId = (typeof SEEDS)[number]["id"];
export const MAX_SEEDS_PER_CLAIM = 3;

export const CLAIM_STATUSES = ["processing", "shipped", "delivered"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = { processing: "Processing", shipped: "Shipped", delivered: "Delivered" };

export const RETURN_STATUS_LABEL: Record<string, string> = { pending: "Waiting for your parcel", verified: "Checked and credited", rejected: "Not accepted" };

/** Where customers post their parcels. */
export const RETURN_ADDRESS = ["Medileaf Returns", "Eco & Recycling Desk", "Address to be confirmed"];

export const MAX_ITEMS_PER_TYPE = 500;

export const isRewardTier = (v: unknown): v is RewardTier => REWARD_TIERS.some((t) => t.items === v);
export const isSeedId = (v: unknown): v is SeedId => SEEDS.some((s) => s.id === v);
export const isClaimStatus = (v: unknown): v is ClaimStatus => typeof v === "string" && (CLAIM_STATUSES as readonly string[]).includes(v);

/** Lifetime verified items (never resets). Only parcels an admin has checked count. */
export function verifiedTotal(rows: { status: string; verified_count: number | null }[]) {
  return rows.reduce((n, r) => n + (r.status === "verified" ? Math.max(0, r.verified_count ?? 0) : 0), 0);
}

/** A tier can be claimed once, and only when the verified total has reached it. */
export function canClaim(total: number, tier: RewardTier, claimed: number[]) {
  return total >= tier && !claimed.includes(tier);
}

/** Progress toward the next tier the user hasn't reached yet. */
export function nextGoal(total: number) {
  const next = REWARD_TIERS.find((t) => total < t.items);
  const top = REWARD_TIERS[REWARD_TIERS.length - 1]!.items;
  if (!next) return { goal: top, remaining: 0, name: null as string | null, start: 0 };
  const idx = REWARD_TIERS.indexOf(next);
  const start = idx === 0 ? 0 : REWARD_TIERS[idx - 1]!.items;
  return { goal: next.items, remaining: next.items - total, name: next.name as string, start };
}

/** Short code printed on the return slip so the admin can find the parcel. */
export function returnCode(id: string) {
  return `ML-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** Validates a seed choice; returns an error message or null. */
export function seedChoiceError(seeds: unknown[]) {
  if (seeds.length < 1) return "Choose at least one seed variety";
  if (seeds.length > MAX_SEEDS_PER_CLAIM) return `Choose up to ${MAX_SEEDS_PER_CLAIM} seed varieties`;
  if (new Set(seeds).size !== seeds.length) return "Each seed variety can be chosen once";
  if (!seeds.every(isSeedId)) return "Unknown seed variety";
  return null;
}
