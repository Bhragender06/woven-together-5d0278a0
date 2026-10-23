import { describe, expect, it } from "vitest";
import { canClaim, nextGoal, seedChoiceError, verifiedTotal } from "@/lib/rewards-logic";

describe("eco rewards", () => {
  it("only counts parcels an admin has checked", () => {
    expect(verifiedTotal([
      { status: "verified", verified_count: 30 },
      { status: "pending", verified_count: null },
      { status: "rejected", verified_count: 0 },
      { status: "verified", verified_count: 12 },
    ])).toBe(42);
  });
  it("keeps seeds locked until 50 checked items", () => {
    expect(canClaim(49, 50, [])).toBe(false);
    expect(canClaim(50, 50, [])).toBe(true);
  });
  it("lets each reward level be claimed only once", () => {
    expect(canClaim(80, 50, [50])).toBe(false);
    expect(canClaim(100, 100, [50])).toBe(true);
  });
  it("uses 50, 100 and 150 item levels without resetting the total", () => {
    expect(nextGoal(35)).toMatchObject({ goal: 50, remaining: 15 });
    expect(nextGoal(60)).toMatchObject({ goal: 100, remaining: 40 });
    expect(nextGoal(149)).toMatchObject({ goal: 150, remaining: 1 });
    expect(nextGoal(150).remaining).toBe(0);
  });
  it("allows 1 to 3 known seed varieties", () => {
    expect(seedChoiceError([])).not.toBeNull();
    expect(seedChoiceError(["sunflower", "lavender", "chamomile"])).toBeNull();
    expect(seedChoiceError(["sunflower", "lavender", "chamomile", "marigold"])).not.toBeNull();
    expect(seedChoiceError(["rose"])).not.toBeNull();
  });
});
