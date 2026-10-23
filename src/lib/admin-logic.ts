/** Pure rules for the admin panel (shared by server functions, UI and tests). */

export const ORDER_STATUSES = ["submitted", "confirmed", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "New",
  confirmed: "Confirmed by pharmacy",
  ready: "Ready / out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** Older orders were stored as "placed"/"draft"; treat them as new. */
export function normalizeOrderStatus(v: string | null | undefined): OrderStatus {
  return isOrderStatus(v) ? v : "submitted";
}

export type RefillInput = {
  medicationId: string;
  userId: string;
  remaining: number;
  dosesPerDay: number;
  thresholdDays: number;
};

/** Whole days of supply left; Infinity when the medicine has no daily doses. */
export function supplyDays(remaining: number, dosesPerDay: number) {
  if (dosesPerDay <= 0) return Infinity;
  return Math.floor(Math.max(0, remaining) / dosesPerDay);
}

/** Medicines at or below the user's own refill-alert threshold, most urgent first. */
export function refillAlerts<T extends RefillInput>(rows: T[]): (T & { daysLeft: number })[] {
  return rows
    .map((r) => ({ ...r, daysLeft: supplyDays(r.remaining, r.dosesPerDay) }))
    .filter((r) => Number.isFinite(r.daysLeft) && r.daysLeft <= r.thresholdDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
