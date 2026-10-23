import { describe, it, expect } from "vitest";
import { buildPersona } from "@/lib/demo-personas";
import { emptyState } from "@/lib/store";
describe("demo personas", () => {
  it("loads Savita with a missed dose and a refill-low medicine", () => {
    const s = buildPersona(emptyState(), "savita", new Date("2026-10-23T12:00:00"));
    expect(s.meds.filter((m) => m.status === "active")).toHaveLength(4);
    expect(s.logs.some((l) => l.status === "missed")).toBe(true);
    expect(s.meds.find((m) => m.name === "Metformin")!.remaining).toBe(6);
  });
});
