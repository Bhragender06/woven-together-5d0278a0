import { describe, expect, it } from "vitest";
import { daysLeft, needsRefill } from "@/lib/store";

describe("refill rules", () => {
  it("days left = remaining / doses per day, rounded down", () => {
    expect(daysLeft({ remaining: 8, dosesPerDay: 3 })).toBe(2);
  });
  it("alerts when days left reaches the threshold", () => {
    expect(needsRefill({ remaining: 10, dosesPerDay: 2 }, 5)).toBe(true);
    expect(needsRefill({ remaining: 12, dosesPerDay: 2 }, 5)).toBe(false);
  });
});
