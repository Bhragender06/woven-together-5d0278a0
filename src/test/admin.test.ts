import { describe, expect, it } from "vitest";
import { isOrderStatus, normalizeOrderStatus, refillAlerts } from "@/lib/admin-logic";

describe("admin order statuses", () => {
  it("accepts only the five order steps an admin can set", () => {
    for (const s of ["submitted", "confirmed", "ready", "completed", "cancelled"]) expect(isOrderStatus(s)).toBe(true);
    expect(isOrderStatus("refunded")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
  });
  it("treats older placed/draft orders as new", () => {
    expect(normalizeOrderStatus("placed")).toBe("submitted");
    expect(normalizeOrderStatus("draft")).toBe("submitted");
    expect(normalizeOrderStatus("ready")).toBe("ready");
  });
});

describe("admin refill alerts", () => {
  const row = (id: string, remaining: number, dosesPerDay: number, thresholdDays: number) => ({ medicationId: id, userId: "u", remaining, dosesPerDay, thresholdDays });
  it("lists medicines at or below each user's own alert level, most urgent first", () => {
    const out = refillAlerts([row("a", 10, 2, 5), row("b", 12, 2, 5), row("c", 2, 1, 3), row("d", 40, 1, 5)]);
    expect(out.map((r) => [r.medicationId, r.daysLeft])).toEqual([["c", 2], ["a", 5]]);
  });
  it("skips medicines with no daily doses", () => {
    expect(refillAlerts([row("x", 0, 0, 5)])).toEqual([]);
  });
});
